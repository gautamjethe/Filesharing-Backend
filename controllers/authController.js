const authService = require('../services/authService');

const register = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const { token, user } = await authService.registerUser(username, email, password);

        res.status(201).json({
            message: 'User created successfully',
            token,
            user
        });
    } catch (error) {
        console.error('Registration error:', error);
        if (error.message === 'User already exists') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Server error' });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const { token, user } = await authService.loginUser(email, password);

        res.json({
            message: 'Login successful',
            token,
            user
        });
    } catch (error) {
        console.error('Login error:', error);
        if (error.message === 'Invalid credentials') {
            return res.status(401).json({ error: error.message });
        }
        res.status(500).json({ error: 'Server error' });
    }
};

const getCurrentUser = async (req, res) => {
    res.json({ user: req.user });
};

module.exports = {
    register,
    login,
    getCurrentUser
};

