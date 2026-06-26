const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const ledgerController = require('../controller/ledgerController');
const authMiddleware = require('../middleware/authMiddleware');
const { uploadDirs } = require('../config/env');

// ─── Multer setup for ledger file uploads ────────────────────────────────────
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDirs.invoices);
    },
    filename: function (req, file, cb) {
        // Same naming convention as invoiceRoute: originalName-timestamp.ext
        const nameWithoutExt = path.parse(file.originalname).name;
        const uploadTime = Date.now();
        cb(null, `${nameWithoutExt}-${uploadTime}${path.extname(file.originalname)}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowed = ['.pdf', '.csv', '.xls', '.xlsx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Only PDF, CSV, XLS, and XLSX files are allowed'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 20 * 1024 * 1024 } // 20 MB per file
});

// ─── Routes ──────────────────────────────────────────────────────────────────

// Get all ledgers for the user's active business
router.get('/', authMiddleware, ledgerController.getLedgers);

// Get a single ledger by ID
router.get('/:id', authMiddleware, ledgerController.getLedgerById);

// Create a new ledger (metadata only, no files)
router.post('/', authMiddleware, ledgerController.createLedger);

// Upload files to an existing ledger (up to 10 files at once)
router.post('/:id/files', authMiddleware, upload.array('files', 10), ledgerController.uploadLedgerFiles);

// Get all files for a ledger
router.get('/:id/files', authMiddleware, ledgerController.getLedgerFiles);

// Get all records for a ledger
router.get('/:id/records', authMiddleware, ledgerController.getLedgerRecords);

// Delete a ledger
router.delete('/:id', authMiddleware, ledgerController.deleteLedger);

module.exports = router;
