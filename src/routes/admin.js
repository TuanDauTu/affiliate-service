const express = require('express');
const router = express.Router();
const prisma = require('../prisma');

/**
 * GET /api/v1/admin/affiliates
 * Danh sách tất cả affiliates kèm thống kê clicks & conversions
 */
router.get('/affiliates', async (req, res) => {
    const { page = 1, limit = 20, search = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    try {
        const where = search
            ? { OR: [{ email: { contains: search } }, { code: { contains: search } }] }
            : {};

        const [affiliates, total] = await Promise.all([
            prisma.affiliate.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' },
                include: {
                    _count: { select: { clicks: true, conversions: true } },
                    conversions: {
                        select: { commissionAmount: true, status: true },
                    },
                },
            }),
            prisma.affiliate.count({ where }),
        ]);

        const data = affiliates.map(a => ({
            id: a.id,
            email: a.email,
            code: a.code,
            status: a.status,
            balance: a.balance,
            totalClicks: a._count.clicks,
            totalConversions: a._count.conversions,
            totalCommission: a.conversions.reduce((s, c) => s + c.commissionAmount, 0),
            approvedCommission: a.conversions
                .filter(c => c.status === 'approved')
                .reduce((s, c) => s + c.commissionAmount, 0),
            createdAt: a.createdAt,
        }));

        res.json({
            data,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (error) {
        console.error('[Admin Affiliates Error]', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PATCH /api/v1/admin/affiliates/:id/status
 * Đổi trạng thái active/inactive của affiliate
 */
router.patch('/affiliates/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({ error: 'Status must be active or inactive' });
    }
    try {
        const updated = await prisma.affiliate.update({ where: { id }, data: { status } });
        res.json({ success: true, id, status: updated.status });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});


/**
 * POST /api/v1/admin/affiliates
 * Tạo affiliate mới từ Admin panel
 */
router.post('/affiliates', async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'Missing email or code' });

    try {
        const tenant = await prisma.tenant.findFirst();
        if (!tenant) return res.status(400).json({ error: 'No tenant found. Run /api/v1/seed first.' });

        const affiliate = await prisma.affiliate.create({
            data: { tenantId: tenant.id, email, code: code.toUpperCase(), status: 'active' },
        });
        res.status(201).json({ success: true, affiliate });
    } catch (error) {
        if (error.code === 'P2002') return res.status(409).json({ error: 'Mã CTV hoặc email đã tồn tại' });
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/v1/admin/conversions/:id
 * Duyệt/Từ chối đơn hoa hồng và cộng tiền vào ví affiliate
 * Body: { action: 'approve' | 'reject' }
 */
router.put('/conversions/:id', async (req, res) => {
    const { id } = req.params;
    const { action } = req.body;

    if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: 'Action must be "approve" or "reject"' });
    }

    try {
        const conversion = await prisma.conversion.findUnique({ where: { id } });
        if (!conversion) return res.status(404).json({ error: 'Conversion not found' });
        if (conversion.status !== 'pending') {
            return res.status(400).json({ error: `Conversion already ${conversion.status}` });
        }

        const newStatus = action === 'approve' ? 'approved' : 'rejected';

        if (action === 'approve') {
            // Duyệt: Cộng tiền hoa hồng vào balance của affiliate
            await prisma.$transaction([
                prisma.conversion.update({ where: { id }, data: { status: 'approved' } }),
                prisma.affiliate.update({
                    where: { id: conversion.affiliateId },
                    data: { balance: { increment: conversion.commissionAmount } },
                }),
            ]);
        } else {
            // Từ chối
            await prisma.conversion.update({ where: { id }, data: { status: 'rejected' } });
        }

        res.json({ success: true, conversionId: id, status: newStatus });
    } catch (error) {
        console.error('[Admin Conversion Error]', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/v1/admin/payouts/:id
 * Xác nhận đã chuyển khoản thanh toán
 */
router.put('/payouts/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const payout = await prisma.payout.findUnique({ where: { id } });
        if (!payout) return res.status(404).json({ error: 'Payout not found' });
        if (payout.status !== 'requested') {
            return res.status(400).json({ error: `Payout already ${payout.status}` });
        }

        await prisma.payout.update({
            where: { id },
            data: { status: 'paid', processedAt: new Date() },
        });

        res.json({ success: true, payoutId: id, status: 'paid' });
    } catch (error) {
        console.error('[Admin Payout Error]', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/v1/admin/overview
 * Báo cáo tổng quan toàn hệ thống
 */
router.get('/overview', async (req, res) => {
    try {
        const [
            totalAffiliates,
            totalClicks,
            totalConversions,
            pendingPayouts,
            revenueStats,
        ] = await Promise.all([
            prisma.affiliate.count({ where: { status: 'active' } }),
            prisma.click.count(),
            prisma.conversion.count(),
            prisma.payout.aggregate({
                where: { status: 'requested' },
                _sum: { amount: true },
                _count: true,
            }),
            prisma.conversion.aggregate({
                where: { status: 'approved' },
                _sum: { orderAmount: true, commissionAmount: true },
            }),
        ]);

        res.json({
            totalAffiliates,
            totalClicks,
            totalConversions,
            conversionRate:
                totalClicks > 0 ? `${((totalConversions / totalClicks) * 100).toFixed(2)}%` : '0%',
            pendingPayouts: {
                count: pendingPayouts._count,
                totalAmount: pendingPayouts._sum.amount || 0,
            },
            revenue: {
                totalOrderAmount: revenueStats._sum.orderAmount || 0,
                totalCommissionPaid: revenueStats._sum.commissionAmount || 0,
            },
        });
    } catch (error) {
        console.error('[Admin Overview Error]', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/v1/admin/conversions
 * Danh sách conversion để admin duyệt/từ chối
 */
router.get('/conversions', async (req, res) => {
    const { page = 1, limit = 20, status = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    try {
        const where = status ? { status } : {};
        const [conversions, total] = await Promise.all([
            prisma.conversion.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' },
                include: {
                    affiliate: { select: { email: true, code: true } },
                    product: { select: { name: true, slug: true } },
                },
            }),
            prisma.conversion.count({ where }),
        ]);

        res.json({
            data: conversions,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/v1/admin/products
 * Danh sách tất cả sản phẩm
 */
router.get('/products', async (req, res) => {
    try {
        const products = await prisma.product.findMany({
            orderBy: { createdAt: 'desc' },
        });
        // Mask apiKey — chỉ hiển prefix + *** để admin biết key tồn tại
        const masked = products.map(p => ({
            ...p,
            apiKey: p.apiKey ? p.apiKey.slice(0, 14) + '••••••••' : null,
        }));
        res.json({ data: masked });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/v1/admin/products/:id/apikey
 * Reveal full apiKey (chỉ hiển khi admin bấm nút xác nhận)
 */
router.get('/products/:id/apikey', async (req, res) => {
    try {
        const product = await prisma.product.findUnique({
            where: { id: req.params.id },
            select: { id: true, name: true, slug: true, apiKey: true },
        });
        if (!product) return res.status(404).json({ error: 'Product not found' });
        res.json({ apiKey: product.apiKey, slug: product.slug, name: product.name });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/v1/admin/products
 * Tạo sản phẩm mới
 */
router.post('/products', async (req, res) => {
    const { name, slug, domain, commissionType, commissionValue, cookieDuration = 30 } = req.body;
    if (!name || !slug || !domain || !commissionType || commissionValue === undefined) {
        return res.status(400).json({ error: 'Missing required fields: name, slug, domain, commissionType, commissionValue' });
    }
    if (!['percentage', 'fixed'].includes(commissionType)) {
        return res.status(400).json({ error: 'commissionType must be "percentage" or "fixed"' });
    }

    try {
        const crypto = require('crypto');
        const tenant = await prisma.tenant.findFirst();
        if (!tenant) return res.status(400).json({ error: 'No tenant found. Run /api/v1/seed first.' });

        // Tự động tạo apiKey unique cho từng product
        const apiKey = 'sk_' + slug.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + crypto.randomBytes(20).toString('hex');

        const product = await prisma.product.create({
            data: {
                tenantId: tenant.id,
                name,
                slug: slug.toLowerCase(),
                domain,
                apiKey,
                commissionType,
                commissionValue: parseFloat(commissionValue),
                cookieDuration: parseInt(cookieDuration),
                isActive: true,
            },
        });
        // Trả về full apiKey 1 lần duy nhất khi tạo
        res.status(201).json({
            success: true,
            product,
            _important: 'Lưu apiKey này ngay! Nó sẽ bị ẩn sau khi reload.',
        });
    } catch (error) {
        if (error.code === 'P2002') return res.status(409).json({ error: 'Slug hoặc apiKey đã tồn tại' });
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PATCH /api/v1/admin/products/:id
 * Cập nhật tất cả các field: name, slug, domain, commission, cookie, isActive
 */
router.patch('/products/:id', async (req, res) => {
    const { id } = req.params;
    const {
        name, slug, domain,
        commissionType, commissionValue,
        cookieDuration, isActive,
    } = req.body;

    try {
        const data = {};

        // Thông tin cơ bản
        if (name !== undefined) data.name = name.trim();
        if (slug !== undefined) data.slug = slug.trim().toLowerCase();
        if (domain !== undefined) data.domain = domain.trim();

        // Commission
        if (commissionType !== undefined) {
            if (!['percentage', 'fixed'].includes(commissionType)) {
                return res.status(400).json({ error: 'commissionType must be "percentage" or "fixed"' });
            }
            data.commissionType = commissionType;
        }
        if (commissionValue !== undefined) data.commissionValue = parseFloat(commissionValue);
        if (cookieDuration !== undefined) data.cookieDuration = parseInt(cookieDuration);
        if (isActive !== undefined) data.isActive = Boolean(isActive);

        if (Object.keys(data).length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        const product = await prisma.product.update({ where: { id }, data });
        res.json({ success: true, product });
    } catch (error) {
        if (error.code === 'P2002') return res.status(409).json({ error: 'Slug đã tồn tại' });
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
