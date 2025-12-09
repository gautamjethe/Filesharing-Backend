const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const { createAuditLog } = require('./auditService');

const uploadFiles = async (files, userId) => {
    const uploadedFiles = [];

    for (const file of files) {
        const [result] = await pool.execute(
            `INSERT INTO files (user_id, filename, original_filename, file_type, file_size, file_path) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                userId,
                file.filename,
                file.originalname,
                path.extname(file.originalname).slice(1).toLowerCase(),
                file.size,
                file.path
            ]
        );

        await createAuditLog(result.insertId, userId, 'upload', 'owner');

        uploadedFiles.push({
            id: result.insertId,
            filename: file.originalname,
            type: path.extname(file.originalname).slice(1).toLowerCase(),
            size: file.size,
            upload_date: new Date()
        });
    }

    return uploadedFiles;
};

const getMyFiles = async (userId) => {
    const [files] = await pool.execute(
        `SELECT id, filename, original_filename, file_type, file_size, upload_date 
         FROM files 
         WHERE user_id = ? 
         ORDER BY upload_date DESC`,
        [userId]
    );
    return files;
};

const getSharedFiles = async (userId) => {
    const [files] = await pool.execute(
        `SELECT f.id, f.original_filename, f.file_type, f.file_size, f.upload_date, 
                u.username as owner_name, fs.created_at as shared_at
         FROM files f
         JOIN file_shares fs ON f.id = fs.file_id
         JOIN users u ON f.user_id = u.id
         WHERE fs.shared_with_user_id = ? 
         AND (fs.expires_at IS NULL OR fs.expires_at > NOW())
         ORDER BY fs.created_at DESC`,
        [userId]
    );
    return files;
};

const getFileById = async (fileId) => {
    const [files] = await pool.execute(
        'SELECT * FROM files WHERE id = ?',
        [fileId]
    );
    return files.length > 0 ? files[0] : null;
};

const downloadFile = async (fileId, userId, fileRole) => {
    const file = await getFileById(fileId);
    if (!file) {
        throw new Error('File not found');
    }
    await createAuditLog(fileId, userId, 'download', fileRole);
    return file;
};

const getFileInfo = async (fileId) => {
    const [files] = await pool.execute(
        'SELECT id, original_filename, file_type, file_size, upload_date FROM files WHERE id = ?',
        [fileId]
    );
    return files.length > 0 ? files[0] : null;
};

const shareFileWithUsers = async (fileId, ownerId, userIds, expiresAt) => {
    const sharesCreated = [];
    const sharesUpdated = [];
    const invalidUsers = [];

    const expiresAtValue = expiresAt ? new Date(expiresAt) : null;

    for (const userId of userIds) {
        const [users] = await pool.execute('SELECT id, username FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            invalidUsers.push(userId);
            continue;
        }

        const [existingShares] = await pool.execute(
            'SELECT id FROM file_shares WHERE file_id = ? AND shared_with_user_id = ? AND (expires_at IS NULL OR expires_at > NOW())',
            [fileId, userId]
        );

        if (existingShares.length > 0) {
            const shareId = existingShares[0].id;
            await pool.execute(
                'UPDATE file_shares SET expires_at = ? WHERE id = ?',
                [expiresAtValue, shareId]
            );
            sharesUpdated.push({ id: userId, username: users[0].username });
            await createAuditLog(fileId, ownerId, 'share_updated', 'owner');
        } else {
            const [result] = await pool.execute(
                `INSERT INTO file_shares (file_id, owner_id, shared_with_user_id, expires_at) 
                 VALUES (?, ?, ?, ?)`,
                [fileId, ownerId, userId, expiresAtValue]
            );
            sharesCreated.push({ id: result.insertId, username: users[0].username });
            await createAuditLog(fileId, ownerId, 'share', 'owner');
        }
    }

    return { sharesCreated, sharesUpdated, invalidUsers };
};

const createOrUpdateShareLink = async (fileId, ownerId, expiresAt) => {
    const expiresAtValue = expiresAt ? new Date(expiresAt) : null;

    const [existingShares] = await pool.execute(
        `SELECT id, share_token FROM file_shares 
         WHERE file_id = ? AND share_token IS NOT NULL AND shared_with_user_id IS NULL`,
        [fileId]
    );

    let shareToken;
    let isUpdate = false;

    if (existingShares.length > 0) {
        shareToken = existingShares[0].share_token;
        isUpdate = true;
        await pool.execute(
            `UPDATE file_shares SET expires_at = ? WHERE id = ?`,
            [expiresAtValue, existingShares[0].id]
        );
    } else {
        shareToken = uuidv4();
        await pool.execute(
            `INSERT INTO file_shares (file_id, owner_id, share_token, expires_at) 
             VALUES (?, ?, ?, ?)`,
            [fileId, ownerId, shareToken, expiresAtValue]
        );
    }

    await createAuditLog(fileId, ownerId, isUpdate ? 'share_link_updated' : 'share_link', 'owner');

    return { shareToken, isUpdate };
};

const getFileShares = async (fileId) => {
    const [shares] = await pool.execute(
        `SELECT fs.id, fs.share_token, fs.expires_at, fs.created_at,
                u.username, u.email, u.id as user_id
         FROM file_shares fs
         LEFT JOIN users u ON fs.shared_with_user_id = u.id
         WHERE fs.file_id = ?`,
        [fileId]
    );
    return shares;
};

const deleteShare = async (shareId) => {
    await pool.execute('DELETE FROM file_shares WHERE id = ?', [shareId]);
};

const deleteFile = async (fileId, userId) => {
    const [files] = await pool.execute(
        'SELECT * FROM files WHERE id = ? AND user_id = ?',
        [fileId, userId]
    );

    if (files.length === 0) {
        throw new Error('Only owner can delete file');
    }

    const file = files[0];

    if (fs.existsSync(file.file_path)) {
        fs.unlinkSync(file.file_path);
    }

    await pool.execute('DELETE FROM files WHERE id = ?', [fileId]);
};

module.exports = {
    uploadFiles,
    getMyFiles,
    getSharedFiles,
    getFileById,
    downloadFile,
    getFileInfo,
    shareFileWithUsers,
    createOrUpdateShareLink,
    getFileShares,
    deleteShare,
    deleteFile
};

