const fileService = require('../services/fileService');
const { getAuditLogs } = require('../services/auditService');

const uploadFiles = async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const uploadedFiles = await fileService.uploadFiles(req.files, req.user.id);

        res.status(201).json({
            message: 'Files uploaded successfully',
            files: uploadedFiles
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

const getMyFiles = async (req, res) => {
    try {
        const files = await fileService.getMyFiles(req.user.id);
        res.json({ files });
    } catch (error) {
        console.error('Get files error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

const getSharedFiles = async (req, res) => {
    try {
        const files = await fileService.getSharedFiles(req.user.id);
        res.json({ files });
    } catch (error) {
        console.error('Get shared files error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

const downloadFile = async (req, res) => {
    try {
        const { fileId } = req.params;
        const file = await fileService.downloadFile(fileId, req.user.id, req.fileRole);

        res.download(file.file_path, file.original_filename);
    } catch (error) {
        console.error('Download error:', error);
        if (error.message === 'File not found') {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: 'Server error' });
    }
};

const getFileInfoByToken = async (req, res) => {
    try {
        const file = await fileService.getFileInfo(req.fileId);

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        res.json({ file });
    } catch (error) {
        console.error('Get file info error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

const downloadFileByToken = async (req, res) => {
    try {
        const file = await fileService.downloadFile(req.fileId, req.user.id, req.fileRole);

        res.download(file.file_path, file.original_filename);
    } catch (error) {
        console.error('Download error:', error);
        if (error.message === 'File not found') {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: 'Server error' });
    }
};

const shareFileWithUsers = async (req, res) => {
    try {
        const { fileId } = req.params;
        const { userIds, expiresAt } = req.body;

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ error: 'User IDs are required' });
        }

        const { sharesCreated, sharesUpdated, invalidUsers } = await fileService.shareFileWithUsers(
            fileId,
            req.user.id,
            userIds,
            expiresAt
        );

        if (sharesCreated.length === 0 && sharesUpdated.length === 0) {
            return res.status(400).json({
                error: 'No new shares created or updated. All selected users already have active access.'
            });
        }

        res.json({
            message: 'File sharing process completed',
            sharesCreated: sharesCreated.length,
            sharesUpdated: sharesUpdated.length,
            alreadyShared: sharesUpdated.length > 0 ? sharesUpdated : undefined
        });
    } catch (error) {
        console.error('Share error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

const createOrUpdateShareLink = async (req, res) => {
    try {
        const { fileId } = req.params;
        const { expiresAt } = req.body;

        const { shareToken, isUpdate } = await fileService.createOrUpdateShareLink(
            fileId,
            req.user.id,
            expiresAt
        );

        const shareUrl = `${req.protocol}://${req.get('host')}/api/files/share/${shareToken}/download`;

        res.json({
            message: isUpdate ? 'Share link updated' : 'Share link created',
            shareToken,
            shareUrl,
            expiresAt: expiresAt ? new Date(expiresAt) : null
        });
    } catch (error) {
        console.error('Share link error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

const getFileShares = async (req, res) => {
    try {
        const { fileId } = req.params;
        const shares = await fileService.getFileShares(fileId);
        res.json({ shares });
    } catch (error) {
        console.error('Get shares error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

const deleteShare = async (req, res) => {
    try {
        const { shareId } = req.params;
        await fileService.deleteShare(shareId);
        res.json({ message: 'Share removed successfully' });
    } catch (error) {
        console.error('Delete share error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

const getAuditLog = async (req, res) => {
    try {
        const { fileId } = req.params;
        const logs = await getAuditLogs(fileId);
        res.json({ logs });
    } catch (error) {
        console.error('Get audit log error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

const deleteFile = async (req, res) => {
    try {
        const { fileId } = req.params;
        await fileService.deleteFile(fileId, req.user.id);
        res.json({ message: 'File deleted successfully' });
    } catch (error) {
        console.error('Delete file error:', error);
        if (error.message === 'Only owner can delete file') {
            return res.status(403).json({ error: error.message });
        }
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = {
    uploadFiles,
    getMyFiles,
    getSharedFiles,
    downloadFile,
    getFileInfoByToken,
    downloadFileByToken,
    shareFileWithUsers,
    createOrUpdateShareLink,
    getFileShares,
    deleteShare,
    getAuditLog,
    deleteFile
};

