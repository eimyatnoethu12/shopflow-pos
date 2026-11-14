import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/auth.js';
import shopRoutes from './routes/shop.js';
import adminRoutes from './routes/admin.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/errors.js';

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required');

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_ORIGIN?.split(',') || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true, service: 'shopflow-api', timestamp: new Date() }));

// Authentication routes
app.use('/api/auth', authRoutes);

// Super Admin platform owner routes (Protected by requireSuperAdmin inside adminRoutes)
app.use('/api/admin', adminRoutes);

// Shop Admin & Staff routes (Protected by requireAuth and tenant isolation)
app.use('/api', requireAuth, shopRoutes);

// Error handlers
app.use(notFound);
app.use(errorHandler);

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`========================================`);
  console.log(`ShopFlow POS API listening on port ${port}`);
  console.log(`Super Admin API: http://localhost:${port}/api/admin`);
  console.log(`Shop Admin API:  http://localhost:${port}/api`);
  console.log(`========================================`);
});
