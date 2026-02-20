// Setup environment
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const prisma = require('./prisma');

// Import Routes
const trackRoutes = require('./routes/track');
const affiliateRoutes = require('./routes/affiliate');
const adminRoutes = require('./routes/admin');
const adminAuth = require('./middleware/adminAuth');

const app = express();
const PORT = process.env.PORT || 4000;

// =================== Middleware ===================
app.use(helmet({ contentSecurityPolicy: false }));

const ALLOWED_ORIGINS = [
  'https://suckhoetaichinh.vn',
  'https://www.suckhoetaichinh.vn',
  'https://affiliate.suckhoetaichinh.vn',
  'http://localhost:3000',
  'http://localhost:4000',
  'http://127.0.0.1:3000',
];
app.use(cors({
  origin: (origin, callback) => {
    // Cho phép requests không có origin (curl, mobile apps, server-to-server)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());

// =================== Static: Dashboard UI ===================
app.use('/dashboard', express.static(path.join(__dirname, '../dashboard')));

// =================== Routes ===================
app.get('/', (req, res) => {
  res.json({
    service: 'Affiliate Service',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      track: 'POST /api/v1/track/click, POST /api/v1/track/conversion',
      affiliate: 'GET /api/v1/affiliate/dashboard, GET /api/v1/affiliate/conversions, POST /api/v1/affiliate/payouts',
      admin: 'GET /api/v1/admin/overview, PUT /api/v1/admin/conversions/:id, PUT /api/v1/admin/payouts/:id',
    },
  });
});

// Health Check
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('[Health Check Failed] Error:', error); // Log lỗi chi tiết ra console để debug
    // Nếu chưa config Database, trả về 200 để Railway không kill app (giúp debug dễ hơn)
    if (!process.env.DATABASE_URL) {
      return res.status(200).json({
        status: 'maintenance',
        message: 'DATABASE_URL missing. Please configure variables in Railway Dashboard.',
        database: 'disconnected'
      });
    }
    // Nếu đã config mà lỗi kết nối -> 500 (Lỗi thật)
    res.status(500).json({ status: 'error', database: 'disconnected', error: error.message });
  }
});

// Seed (Dev Helper — Protected by adminAuth)
app.get('/api/v1/seed', adminAuth, async (req, res) => {
  try {
    const crypto = require('crypto');

    let tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      tenant = await prisma.tenant.create({ data: { name: 'Default Tenant' } });
    }

    let product = await prisma.product.findUnique({ where: { slug: 'app1' } });
    if (!product) {
      product = await prisma.product.create({
        data: {
          tenantId: tenant.id,
          name: 'Sức Khỏe Tài Chính',
          slug: 'app1',
          domain: 'suckhoetaichinh.vn',
          apiKey: 'sk_app1_' + crypto.randomBytes(24).toString('hex'), // unique per product
          commissionType: 'percentage',
          commissionValue: 0.2,  // 20%
          cookieDuration: 30,
        },
      });
    }

    let affiliate = await prisma.affiliate.findUnique({ where: { code: 'DEMO001' } });
    if (!affiliate) {
      affiliate = await prisma.affiliate.create({
        data: {
          tenantId: tenant.id,
          email: 'demo@example.com',
          code: 'DEMO001',
          status: 'active',
        },
      });
    }

    res.json({
      message: 'Database seeded!',
      product: { ...product, _note: 'Copy apiKey vào frontend config!' },
      affiliate,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



/**
 * GET /go/:productSlug?ref=CODE
 * 🔀 Server-side redirect — "Affiliate ở tầng trung gian"
 *
 * Luồng:
 *   User click link CTV → Server nhận → Ghi click DB → Set cookie → Redirect
 *
 * Lợi ích so với client-side tracking:
 *   ✅ Không bị Adblock chặn
 *   ✅ Cookie set từ server (tin cậy hơn)
 *   ✅ Ghi click trước khi user thấy trang (không mất dù JS lỗi)
 */
app.get('/go/:productSlug', async (req, res) => {
  const { productSlug } = req.params;
  const refCode = req.query.ref;

  // Default fallback URL khi không tìm thấy product
  let redirectUrl = 'https://suckhoetaichinh.vn';

  try {
    const product = await prisma.product.findUnique({
      where: { slug: productSlug, isActive: true },
    });

    if (!product) {
      console.warn(`[/go] Product not found: ${productSlug}`);
      return res.redirect(302, redirectUrl);
    }

    // Redirect destination = domain của product (hoặc fallback)
    redirectUrl = product.domain.startsWith('http')
      ? product.domain
      : `https://${product.domain}`;

    if (refCode) {
      const affiliate = await prisma.affiliate.findUnique({
        where: { code: refCode.toUpperCase() },
      });

      if (affiliate && affiliate.status === 'active' && affiliate.tenantId === product.tenantId) {
        // ✅ Ghi click vào DB — server-side, không cần JS
        await prisma.click.create({
          data: {
            productId: product.id,
            affiliateId: affiliate.id,
            ipAddress: req.ip || req.headers['x-forwarded-for'] || 'unknown',
            userAgent: req.headers['user-agent'] || 'unknown',
          },
        });

        // ✅ Set cookie từ server — không bị Adblock chặn
        const maxAge = product.cookieDuration * 24 * 60 * 60 * 1000; // ms
        const cookieOpts = {
          maxAge,
          httpOnly: false,   // frontend JS cần đọc được để gửi conversion
          sameSite: 'Lax',
          path: '/',
        };
        res.cookie('affiliate_id', affiliate.id, cookieOpts);
        res.cookie('affiliate_product_id', product.id, cookieOpts);
        res.cookie('affiliate_ref', affiliate.code, cookieOpts);

        console.log(`[/go] ✅ Click tracked: ${affiliate.code} → ${product.slug}`);
      } else {
        console.warn(`[/go] ⚠️  Invalid ref "${refCode}" for product "${productSlug}"`);
      }
    }

    // Redirect về trang đích (kèm ref trong URL để fallback nếu cookie bị xóa)
    const destUrl = new URL(redirectUrl);
    if (refCode) destUrl.searchParams.set('ref', refCode);
    return res.redirect(302, destUrl.toString());

  } catch (error) {
    console.error('[/go Error]', error.message);
    return res.redirect(302, redirectUrl);
  }
});

// Mount Routes
app.use('/api/v1/track', trackRoutes);
app.use('/api/v1/affiliate', affiliateRoutes);
app.use('/api/v1/admin', adminAuth, adminRoutes);


// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Start Server
app.listen(PORT, () => {
  console.log(`✅ Affiliate Service running on http://localhost:${PORT}`);
  console.log(`📄 API Docs: http://localhost:${PORT}/`);
});
