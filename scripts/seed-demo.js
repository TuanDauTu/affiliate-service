/**
 * seed-demo.js — Khởi tạo dữ liệu test đa dạng
 * 2 Tenants · 4 Products (apps) · 20 Affiliates · Clicks · Conversions
 *
 * Chạy: node scripts/seed-demo.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const p = new PrismaClient();

// ─── Helpers ────────────────────────────────────────────────
const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rndInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const rndDate = (daysAgo) => {
    const d = new Date();
    d.setDate(d.getDate() - rndInt(0, daysAgo));
    d.setHours(rndInt(6, 22), rndInt(0, 59));
    return d;
};
const genKey = (slug) => 'sk_' + slug.replace(/[^a-z0-9]/g, '') + '_' + crypto.randomBytes(20).toString('hex');

// ─── Data Definitions ───────────────────────────────────────

const TENANTS = [
    { name: 'Sức Khỏe Tài Chính' },
    { name: 'EduViet Platform' },
];

const PRODUCTS = [
    // Tenant 0 — SKTC
    {
        tenantIdx: 0,
        name: 'App Bác Sĩ Tài Chính',
        slug: 'sktc-app1',
        domain: 'suckhoetaichinh.vn',
        commissionType: 'percentage',
        commissionValue: 0.20,   // 20%
        cookieDuration: 30,
    },
    {
        tenantIdx: 0,
        name: 'Khóa Học Tài Chính Cá Nhân',
        slug: 'sktc-course',
        domain: 'course.suckhoetaichinh.vn',
        commissionType: 'fixed',
        commissionValue: 150000,  // 150k cố định
        cookieDuration: 60,
    },
    // Tenant 1 — EduViet
    {
        tenantIdx: 1,
        name: 'EduViet Premium Membership',
        slug: 'eduviet-premium',
        domain: 'eduviet.vn',
        commissionType: 'percentage',
        commissionValue: 0.15,   // 15%
        cookieDuration: 45,
    },
    {
        tenantIdx: 1,
        name: 'EduViet Workshop Series',
        slug: 'eduviet-workshop',
        domain: 'workshop.eduviet.vn',
        commissionType: 'fixed',
        commissionValue: 80000,  // 80k cố định
        cookieDuration: 14,
    },
];

const AFFILIATE_NAMES = [
    { email: 'nguyen.van.a@gmail.com', code: 'NVA001', name: 'Nguyễn Văn A' },
    { email: 'tran.thi.b@gmail.com', code: 'TTB002', name: 'Trần Thị B' },
    { email: 'le.van.c@gmail.com', code: 'LVC003', name: 'Lê Văn C' },
    { email: 'pham.thi.d@gmail.com', code: 'PTD004', name: 'Phạm Thị D' },
    { email: 'hoang.van.e@gmail.com', code: 'HVE005', name: 'Hoàng Văn E' },
    { email: 'nguyen.thi.f@gmail.com', code: 'NTF006', name: 'Nguyễn Thị F' },
    { email: 'do.van.g@gmail.com', code: 'DVG007', name: 'Đỗ Văn G' },
    { email: 'vu.thi.h@gmail.com', code: 'VTH008', name: 'Vũ Thị H' },
    { email: 'dang.van.i@gmail.com', code: 'DVI009', name: 'Đặng Văn I' },
    { email: 'bui.thi.j@gmail.com', code: 'BTJ010', name: 'Bùi Thị J' },
    { email: 'trinh.van.k@gmail.com', code: 'TVK011', name: 'Trịnh Văn K' },
    { email: 'ly.thi.l@gmail.com', code: 'LTL012', name: 'Lý Thị L' },
    { email: 'mai.van.m@gmail.com', code: 'MVM013', name: 'Mai Văn M' },
    { email: 'ngo.thi.n@gmail.com', code: 'NTN014', name: 'Ngô Thị N' },
    { email: 'dinh.van.o@gmail.com', code: 'DVO015', name: 'Đinh Văn O' },
    { email: 'phan.thi.p@gmail.com', code: 'PTP016', name: 'Phan Thị P' },
    { email: 'truong.van.q@gmail.com', code: 'TVQ017', name: 'Trương Văn Q' },
    { email: 'ho.thi.r@gmail.com', code: 'HTR018', name: 'Hồ Thị R' },
    { email: 'cao.van.s@gmail.com', code: 'CVS019', name: 'Cao Văn S' },
    { email: 'tong.thi.t@gmail.com', code: 'TTT020', name: 'Tống Thị T' },
];

const ORDER_AMOUNTS = {
    'sktc-app1': [199000, 399000, 599000, 990000],
    'sktc-course': [499000, 799000, 1200000, 1500000],
    'eduviet-premium': [299000, 499000, 699000],
    'eduviet-workshop': [149000, 249000, 399000],
};

// ─── Main ────────────────────────────────────────────────────

async function main() {
    console.log('\n🌱  BẮT ĐẦU SEED DỮ LIỆU DEMO...\n');

    // 1. Tenants
    console.log('📂  Tạo Tenants...');
    const tenants = [];
    for (const t of TENANTS) {
        let tenant = await p.tenant.findFirst({ where: { name: t.name } });
        if (!tenant) {
            tenant = await p.tenant.create({ data: { name: t.name } });
            console.log(`   ✅  ${tenant.name}`);
        } else {
            console.log(`   ⏩  ${tenant.name} (đã có)`);
        }
        tenants.push(tenant);
    }

    // 2. Products
    console.log('\n📦  Tạo Products...');
    const products = [];
    for (const pp of PRODUCTS) {
        let product = await p.product.findUnique({ where: { slug: pp.slug } });
        if (!product) {
            product = await p.product.create({
                data: {
                    tenantId: tenants[pp.tenantIdx].id,
                    name: pp.name,
                    slug: pp.slug,
                    domain: pp.domain,
                    apiKey: genKey(pp.slug),
                    commissionType: pp.commissionType,
                    commissionValue: pp.commissionValue,
                    cookieDuration: pp.cookieDuration,
                    isActive: true,
                },
            });
            const commStr = pp.commissionType === 'percentage'
                ? (pp.commissionValue * 100) + '%'
                : pp.commissionValue.toLocaleString('vi-VN') + 'đ';
            console.log(`   ✅  [${tenants[pp.tenantIdx].name}] ${product.name} — HH: ${commStr}`);
        } else {
            console.log(`   ⏩  ${product.name} (đã có)`);
        }
        products.push(product);
    }

    // 3. Affiliates (gán vào cả 2 tenants luân phiên)
    console.log('\n👥  Tạo Affiliates...');
    const affiliates = [];
    for (let i = 0; i < AFFILIATE_NAMES.length; i++) {
        const a = AFFILIATE_NAMES[i];
        let affiliate = await p.affiliate.findUnique({ where: { code: a.code } });
        if (!affiliate) {
            // Phân phối đều: 10 người vào SKTC, 10 người vào EduViet
            const tenantIdx = i < 10 ? 0 : 1;
            affiliate = await p.affiliate.create({
                data: {
                    tenantId: tenants[tenantIdx].id,
                    email: a.email,
                    code: a.code,
                    status: i === 18 ? 'suspended' : 'active', // 1 CTV bị suspend để test
                    balance: 0,
                },
            });
            console.log(`   ✅  ${a.code} — ${a.name} (${tenants[tenantIdx].name})`);
        } else {
            console.log(`   ⏩  ${a.code} (đã có)`);
        }
        affiliates.push(affiliate);
    }

    // 4. Clicks (150+ records)
    console.log('\n🖱️   Tạo Clicks...');
    const existingClicks = await p.click.count();
    if (existingClicks > 0) {
        console.log(`   ⏩  Đã có ${existingClicks} clicks, bỏ qua`);
    } else {
        let clickCount = 0;
        for (const product of products) {
            // Lọc affiliate cùng tenant
            const productAffiliates = affiliates.filter(a =>
                a.tenantId === product.tenantId && a.status === 'active'
            );
            const numClicks = rndInt(30, 50);
            for (let i = 0; i < numClicks; i++) {
                const aff = rnd(productAffiliates);
                await p.click.create({
                    data: {
                        productId: product.id,
                        affiliateId: aff.id,
                        ipAddress: `${rndInt(1, 255)}.${rndInt(0, 255)}.${rndInt(0, 255)}.${rndInt(1, 254)}`,
                        userAgent: rnd([
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120',
                            'Mozilla/5.0 (iPhone; CPU iPhone OS 17) Safari/605',
                            'Mozilla/5.0 (Macintosh; Intel Mac OS X 14) Firefox/121',
                            'Mozilla/5.0 (Android 13; Mobile) Chrome/119',
                        ]),
                        createdAt: rndDate(60),
                    },
                });
                clickCount++;
            }
        }
        console.log(`   ✅  Đã tạo ${clickCount} clicks`);
    }

    // 5. Conversions (60+ records, trạng thái hỗn hợp)
    console.log('\n💰  Tạo Conversions...');
    const existingConversions = await p.conversion.count();
    if (existingConversions > 0) {
        console.log(`   ⏩  Đã có ${existingConversions} conversions, bỏ qua`);
    } else {
        const statuses = ['pending', 'pending', 'pending', 'approved', 'approved', 'rejected'];
        let convCount = 0;
        let orderSeq = 1000;

        for (const product of products) {
            const productAffiliates = affiliates.filter(a =>
                a.tenantId === product.tenantId && a.status === 'active'
            );
            const amounts = ORDER_AMOUNTS[product.slug];
            const numConversions = rndInt(12, 20);

            for (let i = 0; i < numConversions; i++) {
                const aff = rnd(productAffiliates);
                const orderAmount = rnd(amounts);
                let commissionAmount;
                if (product.commissionType === 'percentage') {
                    commissionAmount = orderAmount * product.commissionValue;
                } else {
                    commissionAmount = product.commissionValue;
                }
                const status = rnd(statuses);
                const orderId = `${product.slug.toUpperCase().replace(/-/g, '')}-${orderSeq++}`;

                await p.conversion.create({
                    data: {
                        productId: product.id,
                        affiliateId: aff.id,
                        orderId,
                        orderAmount,
                        commissionAmount,
                        status,
                        createdAt: rndDate(60),
                    },
                });
                convCount++;
            }
        }
        console.log(`   ✅  Đã tạo ${convCount} conversions`);
    }

    // 6. Cập nhật balance cho CTV dựa trên approved conversions
    console.log('\n💳  Cập nhật balance cho Affiliates...');
    for (const aff of affiliates) {
        const approvedConversions = await p.conversion.findMany({
            where: { affiliateId: aff.id, status: 'approved' },
        });
        const balance = approvedConversions.reduce((sum, c) => sum + c.commissionAmount, 0);
        if (balance > 0) {
            await p.affiliate.update({
                where: { id: aff.id },
                data: { balance },
            });
        }
    }
    console.log('   ✅  Xong!');

    // 7. Print Summary
    const snapshot = {
        tenants: await p.tenant.count(),
        products: await p.product.count(),
        affiliates: await p.affiliate.count(),
        clicks: await p.click.count(),
        conversions: await p.conversion.count(),
        pending: await p.conversion.count({ where: { status: 'pending' } }),
        approved: await p.conversion.count({ where: { status: 'approved' } }),
        rejected: await p.conversion.count({ where: { status: 'rejected' } }),
    };

    // Print API Keys for config
    const allProducts = await p.product.findMany({ select: { slug: true, name: true, apiKey: true } });

    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║             📊  SEED HOÀN THÀNH                     ║');
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log(`║  🏢  Tenants:      ${String(snapshot.tenants).padEnd(32)}║`);
    console.log(`║  📦  Products:     ${String(snapshot.products).padEnd(32)}║`);
    console.log(`║  👥  Affiliates:   ${String(snapshot.affiliates + ' (1 suspended)').padEnd(32)}║`);
    console.log(`║  🖱️   Clicks:       ${String(snapshot.clicks).padEnd(32)}║`);
    console.log(`║  💰  Conversions:  ${String(snapshot.conversions).padEnd(32)}║`);
    console.log(`║     ⏳ Pending:    ${String(snapshot.pending).padEnd(32)}║`);
    console.log(`║     ✅ Approved:   ${String(snapshot.approved).padEnd(32)}║`);
    console.log(`║     ❌ Rejected:   ${String(snapshot.rejected).padEnd(32)}║`);
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log('║  🔑  API KEYS (dùng để test conversion tracking):   ║');
    allProducts.forEach(pp => {
        console.log(`║  [${pp.slug}]`);
        console.log(`║   ${pp.apiKey}`);
    });
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log('║  🔗  TEST LINKS:                                     ║');
    console.log('║  http://localhost:3000/?ref=NVA001  (SKTC CTV 1)    ║');
    console.log('║  http://localhost:3000/?ref=TTB002  (SKTC CTV 2)    ║');
    console.log('║  http://localhost:3000/?ref=LVC003  (SKTC CTV 3)    ║');
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log('║  🖥️   Admin:  http://localhost:4000/dashboard/admin  ║');
    console.log('║  📊  Prisma:  http://localhost:5555                  ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');
}

main().catch(e => {
    console.error('❌ Seed thất bại:', e.message);
    process.exit(1);
}).finally(() => p.$disconnect());
