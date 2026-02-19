const express = require('express');
const router = express.Router();
const prisma = require('../prisma');

/**
 * GET /api/v1/affiliate/dashboard?code=XXXX
 * Dashboard thống kê cho Affiliate
 */
router.get('/dashboard', async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.status(400).json({ error: 'Missing affiliate code' });
    }

    try {
        const affiliate = await prisma.affiliate.findUnique({ where: { code } });
        if (!affiliate) {
            return res.status(404).json({ error: 'Affiliate not found' });
        }

        // Lấy toàn bộ thống kê song song
        const [totalClicks, totalConversions, pendingConversions, approvedConversions, payouts] =
            await Promise.all([
                prisma.click.count({ where: { affiliateId: affiliate.id } }),

                prisma.conversion.count({ where: { affiliateId: affiliate.id } }),

                prisma.conversion.aggregate({
                    where: { affiliateId: affiliate.id, status: 'pending' },
                    _sum: { commissionAmount: true },
                    _count: true,
                }),

                prisma.conversion.aggregate({
                    where: { affiliateId: affiliate.id, status: 'approved' },
                    _sum: { commissionAmount: true },
                    _count: true,
                }),

                prisma.payout.aggregate({
                    where: { affiliateId: affiliate.id, status: 'paid' },
                    _sum: { amount: true },
                }),
            ]);

        const conversionRate =
            totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(2) : '0.00';

        // Lấy product slug đầu tiên của tenant để build link /go/
        const firstProduct = await prisma.product.findFirst({
            where: { tenantId: affiliate.tenantId, isActive: true },
            orderBy: { createdAt: 'asc' },
            select: { slug: true },
        });

        res.json({
            affiliate: {
                code: affiliate.code,
                email: affiliate.email,
                balance: affiliate.balance,
                status: affiliate.status,
                productSlug: firstProduct?.slug || null, // dùng để build link /go/
            },
            stats: {
                totalClicks,
                totalConversions,
                conversionRate: `${conversionRate}%`,
            },
            commissions: {
                pending: {
                    count: pendingConversions._count,
                    amount: pendingConversions._sum.commissionAmount || 0,
                },
                approved: {
                    count: approvedConversions._count,
                    amount: approvedConversions._sum.commissionAmount || 0,
                },
                totalPaid: payouts._sum.amount || 0,
            },
        });

    } catch (error) {
        console.error('[Affiliate Dashboard Error]', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/v1/affiliate/conversions?code=XXXX
 * Danh sách các đơn giới thiệu thành công
 */
router.get('/conversions', async (req, res) => {
    const { code, page = 1, limit = 10 } = req.query;

    if (!code) return res.status(400).json({ error: 'Missing affiliate code' });

    try {
        const affiliate = await prisma.affiliate.findUnique({ where: { code } });
        if (!affiliate) return res.status(404).json({ error: 'Affiliate not found' });

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [conversions, total] = await Promise.all([
            prisma.conversion.findMany({
                where: { affiliateId: affiliate.id },
                orderBy: { createdAt: 'desc' },
                skip,
                take: parseInt(limit),
                select: {
                    id: true,
                    orderId: true,
                    orderAmount: true,
                    commissionAmount: true,
                    status: true,
                    createdAt: true,
                },
            }),
            prisma.conversion.count({ where: { affiliateId: affiliate.id } }),
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
        console.error('[Affiliate Conversions Error]', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/v1/affiliate/payouts
 * Tạo yêu cầu rút tiền
 * Body: { code, amount }
 */
router.post('/payouts', async (req, res) => {
    const { code, amount } = req.body;
    const MINIMUM_PAYOUT = 500000; // 500.000đ

    if (!code || !amount) return res.status(400).json({ error: 'Missing code or amount' });
    if (amount < MINIMUM_PAYOUT) {
        return res.status(400).json({
            error: `Số tiền rút tối thiểu là ${MINIMUM_PAYOUT.toLocaleString('vi-VN')}đ`,
        });
    }

    try {
        const affiliate = await prisma.affiliate.findUnique({ where: { code } });
        if (!affiliate) return res.status(404).json({ error: 'Affiliate not found' });
        if (affiliate.balance < amount) {
            return res.status(400).json({ error: 'Số dư không đủ' });
        }

        // Tạo payout và giảm balance trong 1 transaction
        const [payout] = await prisma.$transaction([
            prisma.payout.create({
                data: { affiliateId: affiliate.id, amount, status: 'requested' },
            }),
            prisma.affiliate.update({
                where: { id: affiliate.id },
                data: { balance: { decrement: amount } },
            }),
        ]);

        res.json({ success: true, payoutId: payout.id, amount, status: 'requested' });
    } catch (error) {
        console.error('[Payout Request Error]', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
