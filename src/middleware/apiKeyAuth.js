/**
 * productKeyAuth middleware (nâng cấp từ apiKeyAuth)
 * Mỗi Product có apiKey riêng trong DB — multi-app safe
 * Client phải gửi header: X-API-Key: <product.apiKey>
 *
 * Sau khi pass: req.product chứa thông tin Product tương ứng
 * (không cần query lại product trong route handler)
 */
const prisma = require('../prisma');

module.exports = async function productKeyAuth(req, res, next) {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Missing X-API-Key header',
        });
    }

    try {
        const product = await prisma.product.findUnique({
            where: { apiKey },
        });

        if (!product) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Invalid API key',
            });
        }

        if (!product.isActive) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Product is inactive',
            });
        }

        // Gắn product vào request — route handler dùng luôn, không cần query lại
        req.product = product;
        next();
    } catch (error) {
        console.error('[productKeyAuth Error]', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
