const TeamModel = require('../model/teamModel');

/**
 * Middleware factory to enforce Role-Based Access Control (RBAC).
 *
 * @param {Array<string>} allowedRoles - List of permitted roles (e.g. ['admin', 'accountant'])
 */
const checkRole = (allowedRoles = []) => {
    return async (req, res, next) => {
        try {
            const userId = req.user?.userId || req.user?.id;
            if (!userId) {
                return res.status(401).json({ message: 'Authentication required' });
            }

            // Extract businessId from params, body, headers, or query
            const businessId = req.body?.businessId 
                || req.body?.business_id 
                || req.params?.businessId 
                || req.query?.businessId 
                || req.headers['x-business-id'];

            // Actions without explicit business scope (e.g. creating a new business)
            if (!businessId) {
                const userRole = await TeamModel.getUserRole(userId, null);
                // System admin or actions allowing accountant role when creating new business
                if (userRole === 'admin' || allowedRoles.includes('accountant') || allowedRoles.length === 0) {
                    req.userRole = userRole || 'accountant';
                    return next();
                }
            }

            const role = await TeamModel.getUserRole(userId, businessId);

            // Super Admin has universal access
            if (role === 'admin') {
                req.userRole = 'admin';
                return next();
            }

            if (!role || !allowedRoles.includes(role)) {
                return res.status(403).json({
                    message: `Access denied. Action requires one of: [${allowedRoles.join(', ')}]. Your role is '${role || 'unassigned'}'.`
                });
            }

            req.userRole = role;
            next();
        } catch (error) {
            console.error('[RBAC] Error verifying role:', error);
            res.status(500).json({ message: 'Server error during authorization check' });
        }
    };
};

module.exports = { checkRole };
