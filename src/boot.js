const { execSync } = require('child_process');

console.log('\n==================================================');
console.log('🚀 STARTING AFFILIATE SERVICE BOOT SEQUENCE');
console.log('==================================================\n');

// 1. Check Environment
if (!process.env.DATABASE_URL) {
    console.error('❌ ERROR: DATABASE_URL variable is MISSING on Railway!');
    console.error('👉 ACTION REQUIRED: Go to Railway Dashboard -> Create PostgreSQL -> Copy DATABASE_URL -> Paste into Service Variables.');
    console.log('⚠️  Skipping migrations and starting server in LIMITED MODE (Database features will fail).\n');
} else {
    // 2. Run Migrations
    try {
        console.log('🔄 Found DATABASE_URL. Attempting to apply Prisma migrations...');
        execSync('npx prisma migrate deploy', { stdio: 'inherit' });
        console.log('✅ Migrations applied successfully.\n');
    } catch (error) {
        console.error('❌ MIGRATION FAILED!');
        console.error('   This might be due to connection params or firewall.');
        console.error('   Error details:', error.message);
        console.log('⚠️  Continuing startup to allow debugging via Logs...\n');
    }
}

// 3. Start Server
console.log('🚀 Starting Express App via src/server.js...');
try {
    require('./server');
} catch (error) {
    console.error('❌ SERVER CRASHED:', error);
    process.exit(1);
}
