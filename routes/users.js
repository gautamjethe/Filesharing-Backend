const express = require('express');
const { authenticate } = require('../middleware/auth');
const userController = require('../controllers/userController');

const router = express.Router();

router.get('/', authenticate, userController.getAllUsers);

module.exports = router;
