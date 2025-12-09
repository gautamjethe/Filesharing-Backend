const pool = require('../config/db');

const createAuditLog = async (fileId, userId, action, role) => {
    await pool.execute(
        'INSERT INTO audit_log (file_id, user_id, action, role) VALUES (?, ?, ?, ?)',
        [fileId, userId, action, role]
    );
};

const getAuditLogs = async (fileId) => {
    const [logs] = await pool.execute(
        `SELECT al.*, u.username, u.email
         FROM audit_log al
         JOIN users u ON al.user_id = u.id
         WHERE al.file_id = ?
         ORDER BY al.created_at DESC`,
        [fileId]
    );
    return logs;
};

module.exports = {
    createAuditLog,
    getAuditLogs
};

