const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const registerUser = async (username, email, password) => {
    const [existingUsers] = await pool.execute(
        'SELECT id FROM users WHERE email = ? OR username = ?',
        [email, username]
    );

    if (existingUsers.length > 0) {
        throw new Error('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.execute(
        'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
        [username, email, hashedPassword]
    );

    const token = jwt.sign(
        { userId: result.insertId },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );

    return {
        token,
        user: {
            id: result.insertId,
            username,
            email
        }
    };
};

const loginUser = async (email, password) => {
    const [users] = await pool.execute(
        'SELECT * FROM users WHERE email = ?',
        [email]
    );

    if (users.length === 0) {
        throw new Error('Invalid credentials');
    }

    const user = users[0];

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
        throw new Error('Invalid credentials');
    }

    const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );

    return {
        token,
        user: {
            id: user.id,
            username: user.username,
            email: user.email
        }
    };
};

module.exports = {
    registerUser,
    loginUser
};

