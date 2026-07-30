const BusinessModel = require('../model/businessModel');

/**
 * Resolves the active business ID for the authenticated request.
 * Priority:
 * 1. HTTP Header `x-business-id`
 * 2. Query param or body `businessId` / `business_id`
 * 3. User's `lastActiveBusinessId` / `last_active_business_id`
 * 4. First business belonging to or shared with the user
 */
const getActiveBusinessId = async (req) => {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) return null;

    const headerBizId = req.headers['x-business-id'];
    if (headerBizId && !isNaN(headerBizId)) {
        return Number(headerBizId);
    }

    const paramBizId = req.query?.businessId || req.body?.businessId || req.body?.business_id;
    if (paramBizId && !isNaN(paramBizId)) {
        return Number(paramBizId);
    }

    if (req.user?.lastActiveBusinessId && !isNaN(req.user.lastActiveBusinessId)) {
        return Number(req.user.lastActiveBusinessId);
    }

    if (req.user?.last_active_business_id && !isNaN(req.user.last_active_business_id)) {
        return Number(req.user.last_active_business_id);
    }

    const businesses = await BusinessModel.findByUserId(userId);
    if (businesses && businesses.length > 0) {
        return businesses[0].id;
    }

    return null;
};

module.exports = { getActiveBusinessId };
