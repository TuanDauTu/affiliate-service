const fs = require('fs');
process.chdir('d:/APP AI/SUCKHOETAICHINH.VN/apps/affiliate-service');

console.log('');
console.log('========================================');
console.log('   RAILWAY DEPLOY READINESS CHECK      ');
console.log('========================================');

const checks = [];
const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const railway = JSON.parse(fs.readFileSync('./railway.json', 'utf8'));
const schema = fs.readFileSync('./prisma/schema.prisma', 'utf8');

checks.push({ name: 'prisma trong dependencies', ok: !!pkg.dependencies['prisma'], detail: pkg.dependencies['prisma'] || 'MISSING' });
checks.push({ name: 'postinstall = prisma generate', ok: pkg.scripts.postinstall === 'prisma generate', detail: pkg.scripts.postinstall });
checks.push({ name: 'start script dung', ok: pkg.scripts.start === 'prisma migrate deploy && node src/server.js', detail: pkg.scripts.start });
checks.push({ name: 'engines.node defined', ok: !!pkg.engines, detail: JSON.stringify(pkg.engines) });
checks.push({ name: 'railway.json startCommand = npm start', ok: railway.deploy.startCommand === 'npm start', detail: railway.deploy.startCommand });
checks.push({ name: 'railway.json healthcheckPath', ok: !!railway.deploy.healthcheckPath, detail: railway.deploy.healthcheckPath });

const files = [
    'src/server.js', 'src/prisma.js', 'src/routes/track.js',
    'src/routes/affiliate.js', 'src/routes/admin.js',
    'src/middleware/apiKeyAuth.js', 'src/middleware/adminAuth.js',
    'prisma/schema.prisma', '.gitignore', 'Procfile', 'railway.json'
];
files.forEach(function (f) {
    checks.push({ name: 'File: ' + f, ok: fs.existsSync(f) });
});

const hasPostgres = schema.indexOf('provider = "postgresql"') !== -1;
checks.push({ name: 'Prisma provider = postgresql', ok: hasPostgres });

const migDirs = fs.readdirSync('./prisma/migrations').filter(function (f) {
    try { return fs.statSync('./prisma/migrations/' + f).isDirectory(); } catch (e) { return false; }
});
checks.push({ name: 'Migrations exist', ok: migDirs.length > 0, detail: migDirs.join(', ') });

// Security check
const serverContent = fs.readFileSync('./src/server.js', 'utf8');
checks.push({ name: 'adminAuth protecting /admin routes', ok: serverContent.indexOf('adminAuth, adminRoutes') !== -1 });
checks.push({ name: 'adminAuth protecting /seed endpoint', ok: serverContent.indexOf('adminAuth, async (req, res)') !== -1 });

let passed = 0, failed = 0;
checks.forEach(function (c) {
    if (c.ok) {
        console.log('  [OK]   ' + c.name + (c.detail ? ' (' + c.detail + ')' : ''));
        passed++;
    } else {
        console.log('  [FAIL] ' + c.name + (c.detail ? ' -> ' + c.detail : ''));
        failed++;
    }
});

console.log('');
console.log('Result: ' + passed + '/' + (passed + failed) + ' checks passed');
if (failed === 0) {
    console.log('READY TO DEPLOY ON RAILWAY!');
} else {
    console.log('Fix ' + failed + ' issue(s) above before deploy');
}
