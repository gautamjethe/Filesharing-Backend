const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { checkFileAccess, checkFileAccessByToken } = require('../middleware/fileAccess');

const router = express.Router();

const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 500 * 1024 * 1024
    }
});

router.post('/upload', authenticate, upload.array('files', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const uploadedFiles = [];

        for (const file of req.files) {
            const [result] = await pool.execute(
                `INSERT INTO files (user_id, filename, original_filename, file_type, file_size, file_path) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    req.user.id,
                    file.filename,
                    file.originalname,
                    path.extname(file.originalname).slice(1).toLowerCase(),
                    file.size,
                    file.path
                ]
            );

            await pool.execute(
                'INSERT INTO audit_log (file_id, user_id, action, role) VALUES (?, ?, ?, ?)',
                [result.insertId, req.user.id, 'upload', 'owner']
            );

            uploadedFiles.push({
                id: result.insertId,
                filename: file.originalname,
                type: path.extname(file.originalname).slice(1).toLowerCase(),
                size: file.size,
                upload_date: new Date()
            });
        }

        res.status(201).json({
            message: 'Files uploaded successfully',
            files: uploadedFiles
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/my-files', authenticate, async (req, res) => {
    try {
        const [files] = await pool.execute(
            `SELECT id, filename, original_filename, file_type, file_size, upload_date 
             FROM files 
             WHERE user_id = ? 
             ORDER BY upload_date DESC`,
            [req.user.id]
        );

        res.json({ files });
    } catch (error) {
        console.error('Get files error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/shared-with-me', authenticate, async (req, res) => {
    try {
        const [files] = await pool.execute(
            `SELECT f.id, f.original_filename, f.file_type, f.file_size, f.upload_date, 
                    u.username as owner_name, fs.created_at as shared_at
             FROM files f
             JOIN file_shares fs ON f.id = fs.file_id
             JOIN users u ON f.user_id = u.id
             WHERE fs.shared_with_user_id = ? 
             AND (fs.expires_at IS NULL OR fs.expires_at > NOW())
             ORDER BY fs.created_at DESC`,
            [req.user.id]
        );

        res.json({ files });
    } catch (error) {
        console.error('Get shared files error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/:fileId/download', authenticate, checkFileAccess, async (req, res) => {
    try {
        const { fileId } = req.params;

        const [files] = await pool.execute(
            'SELECT * FROM files WHERE id = ?',
            [fileId]
        );

        if (files.length === 0) {
            return res.status(404).json({ error: 'File not found' });
        }

        const file = files[0];

        await pool.execute(
            'INSERT INTO audit_log (file_id, user_id, action, role) VALUES (?, ?, ?, ?)',
            [fileId, req.user.id, 'download', req.fileRole]
        );

        res.download(file.file_path, file.original_filename);
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/share/:token/info', authenticate, checkFileAccessByToken, async (req, res) => {
    try {
        const [files] = await pool.execute(
            'SELECT id, original_filename, file_type, file_size, upload_date FROM files WHERE id = ?',
            [req.fileId]
        );

        if (files.length === 0) {
            return res.status(404).json({ error: 'File not found' });
        }

        res.json({ file: files[0] });
    } catch (error) {
        console.error('Get file info error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/share/:token/download', authenticate, checkFileAccessByToken, async (req, res) => {
    try {
        const [files] = await pool.execute(
            'SELECT * FROM files WHERE id = ?',
            [req.fileId]
        );

        if (files.length === 0) {
            return res.status(404).json({ error: 'File not found' });
        }

        const file = files[0];

        await pool.execute(
            'INSERT INTO audit_log (file_id, user_id, action, role) VALUES (?, ?, ?, ?)',
            [req.fileId, req.user.id, 'download', req.fileRole]
        );

        res.download(file.file_path, file.original_filename);
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/:fileId/share', authenticate, checkFileAccess, async (req, res) => {
    try {
        const { fileId } = req.params;
        const { userIds, expiresAt } = req.body;

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ error: 'User IDs are required' });
        }

        const shares = [];
        const alreadyShared = [];
        const invalidUsers = [];

        for (const userId of userIds) {
            const [users] = await pool.execute('SELECT id, username FROM users WHERE id = ?', [userId]);
            if (users.length === 0) {
                invalidUsers.push(userId);
                continue;
            }

            const expiresAtValue = expiresAt ? new Date(expiresAt) : null;

            const [existing] = await pool.execute(
                'SELECT id FROM file_shares WHERE file_id = ? AND shared_with_user_id = ?',
                [fileId, userId]
            );

            if (existing.length > 0) {
                await pool.execute(
                    'UPDATE file_shares SET expires_at = ? WHERE id = ?',
                    [expiresAtValue, existing[0].id]
                );

                await pool.execute(
                    'INSERT INTO audit_log (file_id, user_id, action, role) VALUES (?, ?, ?, ?)',
                    [fileId, req.user.id, 'share_updated', 'owner']
                );

                alreadyShared.push({ id: userId, username: users[0].username });
            } else {
                const [result] = await pool.execute(
                    `INSERT INTO file_shares (file_id, owner_id, shared_with_user_id, expires_at) 
                     VALUES (?, ?, ?, ?)`,
                    [fileId, req.user.id, userId, expiresAtValue]
                );

                await pool.execute(
                    'INSERT INTO audit_log (file_id, user_id, action, role) VALUES (?, ?, ?, ?)',
                    [fileId, req.user.id, 'share', 'owner']
                );

                shares.push(result.insertId);
            }
        }

        res.json({
            message: 'File shared successfully',
            sharesCreated: shares.length,
            sharesUpdated: alreadyShared.length,
            updatedUsers: alreadyShared.length > 0 ? alreadyShared : undefined
        });
    } catch (error) {
        console.error('Share error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/:fileId/share-link', authenticate, checkFileAccess, async (req, res) => {
    try {
        const { fileId } = req.params;
        const { expiresAt } = req.body;

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
                [fileId, req.user.id, shareToken, expiresAtValue]
            );
        }

        await pool.execute(
            'INSERT INTO audit_log (file_id, user_id, action, role) VALUES (?, ?, ?, ?)',
            [fileId, req.user.id, isUpdate ? 'share_link_updated' : 'share_link', 'owner']
        );

        const shareUrl = `${req.protocol}://${req.get('host')}/api/files/share/${shareToken}/download`;

        res.json({
            message: isUpdate ? 'Share link updated' : 'Share link created',
            shareToken,
            shareUrl,
            expiresAt: expiresAtValue
        });
    } catch (error) {
        console.error('Share link error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/:fileId/shares', authenticate, checkFileAccess, async (req, res) => {
    try {
        const { fileId } = req.params;

        const [shares] = await pool.execute(
            `SELECT fs.id, fs.share_token, fs.expires_at, fs.created_at,
                    u.username, u.email, u.id as user_id
             FROM file_shares fs
             LEFT JOIN users u ON fs.shared_with_user_id = u.id
             WHERE fs.file_id = ?`,
            [fileId]
        );

        res.json({ shares });
    } catch (error) {
        console.error('Get shares error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.delete('/:fileId/shares/:shareId', authenticate, checkFileAccess, async (req, res) => {
    try {
        const { shareId } = req.params;

        await pool.execute('DELETE FROM file_shares WHERE id = ?', [shareId]);

        res.json({ message: 'Share removed successfully' });
    } catch (error) {
        console.error('Delete share error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/:fileId/audit-log', authenticate, checkFileAccess, async (req, res) => {
    try {
        const { fileId } = req.params;

        const [logs] = await pool.execute(
            `SELECT al.*, u.username, u.email
             FROM audit_log al
             JOIN users u ON al.user_id = u.id
             WHERE al.file_id = ?
             ORDER BY al.created_at DESC`,
            [fileId]
        );

        res.json({ logs });
    } catch (error) {
        console.error('Get audit log error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.delete('/:fileId', authenticate, checkFileAccess, async (req, res) => {
    try {
        const { fileId } = req.params;

        const [files] = await pool.execute(
            'SELECT * FROM files WHERE id = ? AND user_id = ?',
            [fileId, req.user.id]
        );

        if (files.length === 0) {
            return res.status(403).json({ error: 'Only owner can delete file' });
        }

        const file = files[0];

        if (fs.existsSync(file.file_path)) {
            fs.unlinkSync(file.file_path);
        }

        await pool.execute('DELETE FROM files WHERE id = ?', [fileId]);

        res.json({ message: 'File deleted successfully' });
    } catch (error) {
        console.error('Delete file error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

