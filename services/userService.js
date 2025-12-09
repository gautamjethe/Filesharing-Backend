const pool = require('../config/db');

const getAllUsersExceptCurrent = async (currentUserId) => {
    const [users] = await pool.execute(
        'SELECT id, username, email FROM users WHERE id != ?',
        [currentUserId]
    );
    return users;
};

module.exports = {
    getAllUsersExceptCurrent
};

