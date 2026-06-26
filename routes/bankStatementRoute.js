const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bankStatementController = require('../controller/bankStatementController');
const authMiddleware = require('../middleware/authMiddleware');
const { uploadDirs } = require('../config/env');

const uploadFolder = uploadDirs.bankStatements;
fs.mkdirSync(uploadFolder, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadFolder);
  },
  filename: function (req, file, cb) {
    const baseName = path.parse(file.originalname).name.replace(/[^a-zA-Z0-9-_]/g, '-');
    const uploadTime = Date.now();
    cb(null, `${baseName}-${uploadTime}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
  const allowedExt = path.extname(file.originalname).toLowerCase() === '.csv';

  if (allowedMimeTypes.includes(file.mimetype) || allowedExt) {
    cb(null, true);
  } else {
    cb(new Error('Only CSV files are allowed for bank statement upload.'), false);
  }
};

const upload = multer({ storage, fileFilter });
const router = express.Router();

router.post('/upload', authMiddleware, upload.single('statementCsv'), bankStatementController.uploadStatementGroup);
router.get('/groups', authMiddleware, bankStatementController.getStatementGroups);
router.get('/groups/:id', authMiddleware, bankStatementController.getStatementGroupById);
router.delete('/groups/:id', authMiddleware, bankStatementController.deleteStatementGroup);

module.exports = router;
