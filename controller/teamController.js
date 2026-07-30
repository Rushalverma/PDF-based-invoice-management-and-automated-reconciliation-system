const crypto = require('crypto');
const TeamModel = require('../model/teamModel');
const UserModel = require('../model/userModel');
const { logAudit } = require('../utils/auditLogger');

const getUserId = (req) => req.user.userId || req.user.id;

// ─── POST /api/v1/team/invite ─────────────────────────────────────────────────
const inviteMember = async (req, res) => {
    try {
        const { businessId, email, role = 'viewer' } = req.body;
        const inviterId = getUserId(req);

        if (!businessId || !email) {
            return res.status(400).json({ message: 'Business ID and target email are required' });
        }

        const allowedRoles = ['accountant', 'viewer'];
        if (!allowedRoles.includes(role)) {
            return res.status(400).json({ message: "Role must be 'accountant' or 'viewer'" });
        }

        // Generate 48-hour token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

        const inviteId = await TeamModel.createInvitation(businessId, inviterId, email, role, token, expiresAt);

        await logAudit(req, {
            businessId,
            action: 'INVITE_TEAM_MEMBER',
            entityType: 'invitation',
            entityId: inviteId,
            details: { email, role }
        });

        res.status(201).json({
            message: `Invitation generated successfully for ${email}`,
            invitation: { id: inviteId, email, role, token, expiresAt }
        });
    } catch (error) {
        console.error('Error sending invitation:', error);
        res.status(500).json({ message: 'Server error creating invitation' });
    }
};

// ─── GET /api/v1/team/invitations ─────────────────────────────────────────────
const getPendingInvitations = async (req, res) => {
    try {
        const businessId = req.query.businessId;
        if (!businessId) {
            return res.status(400).json({ message: 'businessId query parameter is required' });
        }

        const invitations = await TeamModel.getPendingInvitations(businessId);
        res.status(200).json({ success: true, invitations });
    } catch (error) {
        console.error('Error fetching invitations:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── POST /api/v1/team/accept-invite ──────────────────────────────────────────
const acceptInvite = async (req, res) => {
    try {
        const { token } = req.body;
        const userId = getUserId(req);

        if (!token) {
            return res.status(400).json({ message: 'Invitation token is required' });
        }

        const invitation = await TeamModel.findByInvitationToken(token);
        if (!invitation) {
            return res.status(400).json({ message: 'Invalid or expired invitation token' });
        }

        await TeamModel.acceptInvitation(invitation.id, userId, invitation.business_id, invitation.role);

        await logAudit(req, {
            businessId: invitation.business_id,
            action: 'ACCEPT_INVITATION',
            entityType: 'user_business_roles',
            entityId: userId,
            details: { role: invitation.role }
        });

        res.status(200).json({
            success: true,
            message: `Successfully joined business as ${invitation.role}`,
            businessId: invitation.business_id,
            role: invitation.role
        });
    } catch (error) {
        console.error('Error accepting invitation:', error);
        res.status(500).json({ message: 'Server error accepting invitation' });
    }
};

// ─── GET /api/v1/team/members ─────────────────────────────────────────────────
const getMembers = async (req, res) => {
    try {
        const businessId = req.query.businessId;
        if (!businessId) {
            return res.status(400).json({ message: 'businessId query parameter is required' });
        }

        const members = await TeamModel.getBusinessMembers(businessId);
        res.status(200).json({ success: true, members });
    } catch (error) {
        console.error('Error fetching team members:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── DELETE /api/v1/team/members/:userId ──────────────────────────────────────
const removeMember = async (req, res) => {
    try {
        const { userId } = req.params;
        const businessId = req.query.businessId || req.body.businessId;

        if (!businessId) {
            return res.status(400).json({ message: 'businessId is required' });
        }

        const affected = await TeamModel.removeMember(businessId, userId);

        await logAudit(req, {
            businessId,
            action: 'REMOVE_TEAM_MEMBER',
            entityType: 'user_business_roles',
            entityId: userId
        });

        res.status(200).json({ success: true, message: 'Team member access removed' });
    } catch (error) {
        console.error('Error removing member:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── GET /api/v1/team/audit-logs ──────────────────────────────────────────────
const getAuditLogs = async (req, res) => {
    try {
        const businessId = req.query.businessId;
        const limit = req.query.limit || 50;
        const offset = req.query.offset || 0;

        const logs = await TeamModel.getAuditLogs(businessId, limit, offset);
        res.status(200).json({ success: true, logs });
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    inviteMember,
    getPendingInvitations,
    acceptInvite,
    getMembers,
    removeMember,
    getAuditLogs
};
