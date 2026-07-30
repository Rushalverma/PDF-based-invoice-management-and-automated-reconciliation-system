const db = require('../config/db');

/**
 * Logs an audit event into audit_logs table.
 *
 * @param {Object} req - Express request object containing authenticated user
 * @param {Object} params - Audit parameters
 * @param {number|null} [params.businessId=null] - ID of the relevant business
 * @param {string} params.action - Action name (e.g. UPLOAD_INVOICE, DELETE_LEDGER)
 * @param {string} params.entityType - Type of entity (e.g. invoice, ledger, reconciliation)
 * @param {string|number|null} [params.entityId=null] - ID of the target entity
 * @param {Object|null} [params.details=null] - Additional action metadata
 */
const logAudit = async (req, { businessId = null, action, entityType, entityId = null, details = null }) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        if (!userId) return;

        const rawIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
        const ipAddress = String(rawIp).split(',')[0].trim();
        const detailsJson = details ? JSON.stringify(details) : null;

        await db.execute(
            `INSERT INTO audit_logs (business_id, user_id, action, entity_type, entity_id, details, ip_address) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [businessId || null, userId, action, entityType, entityId ? String(entityId) : null, detailsJson, ipAddress]
        );
    } catch (error) {
        console.error('[AuditLog] Error recording audit log entry:', error);
    }
};

module.exports = { logAudit };
