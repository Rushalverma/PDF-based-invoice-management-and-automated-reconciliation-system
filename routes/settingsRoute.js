const express = require('express');
const { 
    updateActiveBusiness, 
    getSettingsData, 
    updateUsername, 
    deleteAccount,
    addBusiness,
    deleteBusiness,
    addBankAccount,
    deleteBankAccount
} = require('../controller/settingsController');

const verifyToken = require('../middleware/authMiddleware');
const { checkRole } = require('../middleware/rbacMiddleware');

const router = express.Router();

router.use(verifyToken); // Apply auth check to all settings routes

router.get('/data', getSettingsData);
router.put('/active-business', updateActiveBusiness);
router.put('/username', updateUsername);
router.delete('/account', deleteAccount);

// Sensitive business and bank account operations restricted to Admin & Accountant
router.post('/business', checkRole(['admin', 'accountant']), addBusiness);
router.delete('/business/:id', checkRole(['admin', 'accountant']), deleteBusiness);

router.post('/bank-account', checkRole(['admin', 'accountant']), addBankAccount);
router.delete('/bank-account/:id', checkRole(['admin', 'accountant']), deleteBankAccount);

module.exports = router;