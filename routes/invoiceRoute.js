const express = require('express');
const router = express.Router(); 
const multer = require('multer');
const path = require('path');
const invoiceController = require('../controller/invoiceController');
const authMiddleware = require('../middleware/authMiddleware');
const { uploadDirs } = require('../config/env');

const uploadFolder = uploadDirs.invoices;

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadFolder);
  },
  filename: function (req, file, cb) {
    const nameWithoutExt = path.parse(file.originalname).name;
    const uploadTime = Date.now();
    cb(null, `${nameWithoutExt}-${uploadTime}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed!'), false);
  }
};

const upload = multer({ storage: storage, fileFilter: fileFilter });

// Protected route for uploads
router.post('/upload', authMiddleware, upload.single('invoice'), invoiceController.uploadInvoice);

// Protected route for dashboard stats
router.get('/stats/dashboard', authMiddleware, invoiceController.getDashboardStats);

module.exports = router;
