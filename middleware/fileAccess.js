const pool = require('../config/db');

const checkFileAccess = async (req, res, next) => {
    try {
        const { fileId } = req.params;
        const userId = req.user.id;

        const [files] = await pool.execute(
            'SELECT * FROM files WHERE id = ? AND user_id = ?',
            [fileId, userId]
        );

        if (files.length > 0) {
            req.fileRole = 'owner';
            return next();
        }

        const [shares] = await pool.execute(
            `SELECT fs.*, f.user_id as owner_id 
             FROM file_shares fs 
             JOIN files f ON fs.file_id = f.id 
             WHERE fs.file_id = ? AND fs.shared_with_user_id = ? 
             AND (fs.expires_at IS NULL OR fs.expires_at > NOW())`,
            [fileId, userId]
        );

        if (shares.length > 0) {
            req.fileRole = 'viewer';
            return next();
        }

        return res.status(403).json({ error: 'Access denied' });
    } catch (error) {
        console.error('File access check error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

const checkFileAccessByToken = async (req, res, next) => {
    try {
        const { token } = req.params;
        const userId = req.user.id;

        const [shares] = await pool.execute(
            `SELECT fs.*, f.id as file_id, f.user_id as owner_id 
             FROM file_shares fs 
             JOIN files f ON fs.file_id = f.id 
             WHERE fs.share_token = ? 
             AND (fs.expires_at IS NULL OR fs.expires_at > NOW())`,
            [token]
        );

        if (shares.length === 0) {
            return res.status(404).json({ error: 'Invalid or expired link' });
        }

        const share = shares[0];

        if (share.shared_with_user_id && share.shared_with_user_id !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        req.fileId = share.file_id;
        req.fileRole = share.shared_with_user_id === userId ? 'viewer' : 'viewer';
        next();
    } catch (error) {
        console.error('Token access check error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

module.exports = { checkFileAccess, checkFileAccessByToken };

