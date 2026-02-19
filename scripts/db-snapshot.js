// Helper: xem nhanh dữ liệu trong DB để test
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    const affiliates = await p.affiliate.findMany({
        select: { code: true, email: true, status: true }
    });
    const clicks = await p.click.count();
    const conversions = await p.conversion.count();
    const products = await p.product.findMany({
        select: { name: true, slug: true, commissionType: true, commissionValue: true }
    });

    console.log('\n========  DB SNAPSHOT  ========\n');
    console.log('📦 PRODUCTS:');
    products.forEach(pr => {
        const val = pr.commissionType === 'percentage'
            ? (pr.commissionValue * 100).toFixed(0) + '%'
            : pr.commissionValue.toLocaleString() + 'đ';
        console.log(`   slug="${pr.slug}" | ${pr.name} | HH: ${val}`);
    });

    console.log('\n👥 AFFILIATES (mã CTV để test):');
    affiliates.forEach(a => {
        console.log(`   ref=?ref=${a.code}  |  ${a.email}  |  ${a.status}`);
    });

    console.log('\n📊 TỔNG:');
    console.log(`   Clicks: ${clicks}`);
    console.log(`   Conversions: ${conversions}`);

    console.log('\n🔗 LINK TEST (copy và dán vào browser):');
    affiliates.filter(a => a.status === 'active').forEach(a => {
        console.log(`   http://localhost:3000/?ref=${a.code}`);
    });

    console.log('\n================================\n');
}

main().catch(console.error).finally(() => p.$disconnect());
