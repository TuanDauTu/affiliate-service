/**
 * adminAuth middleware
 * Bảo vệ tất cả /api/v1/admin/* routes
 * Client phải gửi header: X-Admin-Key: <AFFILIATE_API_KEY>
 *
 * Set AFFILIATE_API_KEY trong Railway Dashboard → Variables
 */

module.exports = function adminAuth(req, res, next) {
    const adminKey = req.headers['x-admin-key'];
    const expectedKey = process.env.AFFILIATE_API_KEY;

    if (!expectedKey) {
        console.error('[adminAuth] AFFILIATE_API_KEY not set in environment!');
        return res.status(500).json({ error: 'Server misconfigured: missing AFFILIATE_API_KEY' });
    }

    if (!adminKey) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Missing X-Admin-Key header',
        });
    }

    if (adminKey !== expectedKey) {
        return res.status(403).json({
            error: 'Forbidden',
            message: 'Invalid admin key',
        });
    }

    next();
};
