const { execSync } = require('child_process');
require('dotenv').config(); // Load .env file if present

console.log('\n==================================================');
console.log('🚀 STARTING AFFILIATE SERVICE BOOT SEQUENCE');
console.log('==================================================');

// Debug: Print available environment variables (Keys only + checks)
const keys = Object.keys(process.env).sort();
console.log('🔍 All Environment Keys:', keys.filter(k => !k.startsWith('npm_') && !k.startsWith('NIXPACKS_')).join(', '));

// Deep Search for Typo (e.g. "DATABASE_URL " with space)
const potentialKeys = keys.filter(k => k.includes('DATA') || k.includes('BASE') || k.includes('URL'));
if (potentialKeys.length > 0) {
    console.log('\n🕵️ Found similar keys (Potential Typo?):');
    potentialKeys.forEach(k => {
        console.log(`   - "${k}" (Length: ${k.length}) -> Value exists? ${!!process.env[k]}`);
        if (k !== 'DATABASE_URL') console.log('     ⚠️  WARNING: This key looks suspicious!');
    });
}

// Check common Railway DB variables
const dbVars = ['DATABASE_URL', 'POSTGRES_URL', 'DATABASE_PUBLIC_URL', 'PGUSER', 'PGHOST'];
dbVars.forEach(v => {
    if (process.env[v]) {
        console.log(`✅ ${v} IS SET (Length: ${process.env[v].length})`);
    } else {
        console.log(`❌ ${v} is MISSING`);
    }
});

// Auto-fix: If DATABASE_URL is missing but POSTGRES_URL exists, use it
if (!process.env.DATABASE_URL && process.env.POSTGRES_URL) {
    console.log('⚠️  DATABASE_URL missing, auto-switching to POSTGRES_URL...');
    process.env.DATABASE_URL = process.env.POSTGRES_URL;
}

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

        // Fix "Permission denied" by running node directly on the JS entry point
        // Path: node_modules/prisma/build/index.js
        const cmd = 'node node_modules/prisma/build/index.js migrate deploy --schema=./prisma/schema.prisma';
        console.log(`> Executing: ${cmd}`);

        execSync(cmd, { stdio: 'inherit' });
        console.log('✅ Migrations applied successfully.\n');
    } catch (error) {
        console.error('❌ MIGRATION FAILED!');
        console.error('   Error details:', error.message);

        // Debug: List node_modules/.bin content
        try {
            console.log('--- DEBUG: Listing ./node_modules/.bin ---');
            execSync('ls -l ./node_modules/.bin', { stdio: 'inherit' });
        } catch (e) {
            console.log('Cannot list .bin dir');
        }

        console.log('⚠️  Continuing startup anyway...\n');
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
