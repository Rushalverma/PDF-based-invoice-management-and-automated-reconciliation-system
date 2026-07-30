const express = require('express');
const router = express.Router(); 
const multer = require('multer');
const path = require('path');
const invoiceController = require('../controller/invoiceController');
const authMiddleware = require('../middleware/authMiddleware');
const { checkRole } = require('../middleware/rbacMiddleware');
const storage = multer.memoryStorage();

const sanitizeFilename = (name) => path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);

const fileFilter = (req, file, cb) => {
  file.originalname = sanitizeFilename(file.originalname || '');
  if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed!'), false);
  }
};

const upload = multer({ storage: storage, fileFilter: fileFilter });

// Protected route for uploads
router.post('/upload', authMiddleware, checkRole(['admin', 'accountant']), upload.single('invoice'), invoiceController.uploadInvoice);

// Protected route for dashboard stats
router.get('/stats/dashboard', authMiddleware, invoiceController.getDashboardStats);

module.exports = router;
