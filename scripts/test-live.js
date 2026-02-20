const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Load .env manual (simple regex)
let env = {};
try {
    const envPath = path.resolve(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
            const parts = line.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const val = parts.slice(1).join('=').trim();
                if (key && val) env[key] = val;
            }
        });
    }
} catch (e) {
    // Ignore
}

const ADMIN_KEY = env.AFFILIATE_API_KEY || process.env.AFFILIATE_API_KEY;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query) => new Promise(resolve => rl.question(query, resolve));

async function main() {
    console.log('\n==================================================');
    console.log('🚀 LIVE TESTING AFFILIATE SERVICE (RAILWAY)');
    console.log('==================================================');

    if (!ADMIN_KEY) {
        console.error('❌ ERROR: AFFILIATE_API_KEY not found in local .env');
        console.log('👉 Please add it to your .env file or input manually.');
        process.exit(1);
    }

    // 1. Get Base URL
    let baseUrl = await askQuestion('👉 Enter your Railway App URL (e.g. https://xxx.up.railway.app): ');
    baseUrl = baseUrl.trim().replace(/\/$/, ''); // remove trailing slash

    if (!baseUrl.startsWith('http')) {
        baseUrl = 'https://' + baseUrl;
    }

    console.log(`\nTesting against: ${baseUrl}\n`);

    try {
        // 2. Health Check
        console.log('🩺 Step 1: Checking Health...');
        const healthRes = await fetch(`${baseUrl}/health`);
        const healthData = await healthRes.json();
        console.log(`   Status: ${healthRes.status} ${healthRes.statusText}`);
        console.log(`   Response:`, healthData);
        if (healthRes.status !== 200) throw new Error('Health Check Failed');

        // 3. Seed / Get Data
        console.log('\n🌱 Step 2: Seeding / Fetching Test Data...');
        const seedRes = await fetch(`${baseUrl}/api/v1/seed`, {
            headers: { 'X-Admin-Key': ADMIN_KEY }
        });
        if (seedRes.status !== 200) {
            console.log('Response:', await seedRes.text());
            throw new Error(`Seed Failed: ${seedRes.status}`);
        }
        const seedData = await seedRes.json();
        console.log('   ✅ Seed Data Retrieved!');

        const product = seedData.product;
        const affiliate = seedData.affiliate;

        console.log(`   📦 Product: ${product.name} (Slug: ${product.slug})`);
        console.log(`   🔑 API Key: ${product.apiKey}`);
        console.log(`   👤 Affiliate: ${affiliate.email} (Code: ${affiliate.code})`);

        // 4. Test Click (Redirect)
        console.log('\n🖱️  Step 3: Testing Click Tracking (Redirect)...');
        const clickUrl = `${baseUrl}/go/${product.slug}?ref=${affiliate.code}`;
        console.log(`   Request: GET ${clickUrl}`);

        const clickRes = await fetch(clickUrl, { redirect: 'manual' });
        console.log(`   Status: ${clickRes.status}`);

        if (clickRes.status === 302) {
            console.log(`   ✅ Redirect Location: ${clickRes.headers.get('location')}`);
            const cookies = clickRes.headers.get('set-cookie');
            if (cookies && cookies.includes('affiliate_ref')) {
                console.log('   ✅ Cookies Set: Yes');
            } else {
                console.log('   ⚠️  Warning: No Set-Cookie header found (Might be stripped by proxy?)');
            }
        } else {
            console.log('   ⚠️  Unexpected Status (Expected 302). Maybe redirect auto-followed?');
        }

        // 5. Test Conversion
        console.log('\n💰 Step 4: Testing Conversion Tracking...');
        const orderId = `TEST-${Date.now()}`;
        const amount = 500000;

        const convBody = {
            orderId: orderId,
            amount: amount,
            currency: 'VND',
            // Manual attribution for testing (if API supports it)
            affiliateCode: affiliate.code
        };

        const convRes = await fetch(`${baseUrl}/api/v1/track/conversion`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': product.apiKey
            },
            body: JSON.stringify(convBody)
        });

        const convData = await convRes.json();
        console.log(`   Status: ${convRes.status}`);
        console.log('   Response:', convData);

        if (convRes.status === 200 || convRes.status === 201) {
            console.log('   ✅ Conversion Recorded!');
        } else {
            console.log('   ❌ Conversion Failed (Check API Key or Body)');
        }

        // 6. Verify Admin Stats
        console.log('\n📊 Step 5: Verifying Admin Stats...');
        const statsRes = await fetch(`${baseUrl}/api/v1/admin/overview`, {
            headers: { 'X-Admin-Key': ADMIN_KEY }
        });
        const statsData = await statsRes.json();
        console.log('   Admin Overview:', statsData);

        console.log('\n✅ TEST COMPLETED SUCCESSFULLY!');

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error.message);
    } finally {
        rl.close();
    }
}

main();
