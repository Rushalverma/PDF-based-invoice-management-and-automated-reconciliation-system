const express = require('express');
const {
    inviteMember,
    getPendingInvitations,
    acceptInvite,
    getMembers,
    removeMember,
    getAuditLogs
} = require('../controller/teamController');
const verifyToken = require('../middleware/authMiddleware');
const { checkRole } = require('../middleware/rbacMiddleware');

const router = express.Router();

router.use(verifyToken); // Requires valid authentication

// Invite viewer/accountant team member (Only 'accountant' owner or system 'admin')
router.post('/invite', checkRole(['admin', 'accountant']), inviteMember);

// Get pending invitations for a business
router.get('/invitations', checkRole(['admin', 'accountant']), getPendingInvitations);

// Accept invitation (Any logged in user with valid token)
router.post('/accept-invite', acceptInvite);

// Get business team members
router.get('/members', checkRole(['admin', 'accountant', 'viewer']), getMembers);

// Remove a team member
router.delete('/members/:userId', checkRole(['admin', 'accountant']), removeMember);

// Get audit activity logs
router.get('/audit-logs', checkRole(['admin', 'accountant']), getAuditLogs);

module.exports = router;
