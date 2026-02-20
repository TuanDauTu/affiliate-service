const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const productKeyAuth = require('../middleware/apiKeyAuth');

/**
 * POST /api/v1/track/click
 * Public — gọi từ browser khi user truy cập link affiliate
 * Body: { productSlug, refCode }
 */
router.get('/test', (req, res) => res.json({ message: 'Track route is working!' }));

router.post('/click', async (req, res) => {
    const { productSlug, refCode } = req.body;

    if (!productSlug || !refCode) {
        return res.status(400).json({ error: 'Missing productSlug or refCode' });
    }

    try {
        const product = await prisma.product.findUnique({ where: { slug: productSlug } });
        if (!product || !product.isActive) {
            return res.status(404).json({ error: 'Product not found or inactive' });
        }

        const affiliate = await prisma.affiliate.findUnique({ where: { code: refCode } });
        if (!affiliate || affiliate.status !== 'active') {
            return res.status(404).json({ error: 'Affiliate not found or inactive' });
        }

        const click = await prisma.click.create({
            data: {
                productId: product.id,
                affiliateId: affiliate.id,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'] || 'unknown',
            },
        });

        res.json({
            success: true,
            clickId: click.id,
            affiliateId: affiliate.id,
            productId: product.id,
            cookieDuration: product.cookieDuration,
        });

    } catch (error) {
        console.error('[Track Click Error]', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/v1/track/conversion
 * 🔒 Protected by productKeyAuth — X-API-Key phải khớp với product.apiKey trong DB
 * Mỗi App/Product có key riêng — multi-app safe
 * Body: { orderId, orderAmount, affiliateId }
 *   - productId KHÔNG cần gửi nữa — lấy từ req.product (inject bởi middleware)
 */
router.post('/conversion', productKeyAuth, async (req, res) => {
    // req.product đã được inject bởi productKeyAuth middleware
    const product = req.product;
    const { orderId, orderAmount, affiliateId } = req.body;

    if (!orderId || !orderAmount || !affiliateId) {
        return res.status(400).json({ error: 'Missing required fields: orderId, orderAmount, affiliateId' });
    }

    try {
        // 1. Kiểm tra orderId chưa tồn tại — scoped theo product (multi-app safe)
        const existingConversion = await prisma.conversion.findUnique({
            where: {
                orderId_productId: {   // @@unique([orderId, productId]) trong schema
                    orderId,
                    productId: product.id,
                }
            },
        });
        if (existingConversion) {
            return res.status(409).json({ error: 'Order already tracked for this product' });
        }

        // 2. Validate affiliate thuộc cùng tenant với product
        const affiliate = await prisma.affiliate.findFirst({
            where: { id: affiliateId, tenantId: product.tenantId, status: 'active' },
        });
        if (!affiliate) {
            return res.status(404).json({ error: 'Affiliate not found or inactive' });
        }

        // 3. Tính hoa hồng dựa trên commission rule của product
        let commissionAmount = 0;
        if (product.commissionType === 'percentage') {
            commissionAmount = orderAmount * product.commissionValue;
        } else if (product.commissionType === 'fixed') {
            commissionAmount = product.commissionValue;
        }

        // 4. Lưu conversion (status mặc định là 'pending')
        const conversion = await prisma.conversion.create({
            data: {
                productId: product.id,
                affiliateId,
                orderId,
                orderAmount,
                commissionAmount,
                status: 'pending',
            },
        });

        res.json({
            success: true,
            conversionId: conversion.id,
            productSlug: product.slug,
            commissionAmount,
            status: 'pending',
        });

    } catch (error) {
        console.error('[Track Conversion Error]', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
