const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');
const { checkFileAccess, checkFileAccessByToken } = require('../middleware/fileAccess');
const fileController = require('../controllers/fileController');

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

router.post('/upload', authenticate, upload.array('files', 10), fileController.uploadFiles);

router.get('/my-files', authenticate, fileController.getMyFiles);

router.get('/shared-with-me', authenticate, fileController.getSharedFiles);

router.get('/:fileId/download', authenticate, checkFileAccess, fileController.downloadFile);

router.get('/share/:token/info', authenticate, checkFileAccessByToken, fileController.getFileInfoByToken);

router.get('/share/:token/download', authenticate, checkFileAccessByToken, fileController.downloadFileByToken);

router.post('/:fileId/share', authenticate, checkFileAccess, fileController.shareFileWithUsers);

router.post('/:fileId/share-link', authenticate, checkFileAccess, fileController.createOrUpdateShareLink);

router.get('/:fileId/shares', authenticate, checkFileAccess, fileController.getFileShares);

router.delete('/:fileId/shares/:shareId', authenticate, checkFileAccess, fileController.deleteShare);

router.get('/:fileId/audit-log', authenticate, checkFileAccess, fileController.getAuditLog);

router.delete('/:fileId', authenticate, checkFileAccess, fileController.deleteFile);

module.exports = router;
