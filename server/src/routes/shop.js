import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireOwner } from '../middleware/auth.js';
const router = Router();

router.get('/dashboard', async (req, res, next) => {
  try {
    const t = req.tenant.id;
    const [products, customers, orders, sales, lowStock] = await Promise.all([
      prisma.product.count({ where: { tenantId: t, isActive: true } }),
      prisma.customer.count({ where: { tenantId: t } }),
      prisma.order.count({ where: { tenantId: t } }),
      prisma.order.aggregate({ where: { tenantId: t, paymentStatus: 'PAID' }, _sum: { total: true } }),
      prisma.product.count({ where: { tenantId: t, isActive: true, stock: { lte: 5 } } })
    ]);
    const recentOrders = await prisma.order.findMany({ where: { tenantId: t }, include: { customer: true, items: true }, orderBy: { createdAt: 'desc' }, take: 5 });
    res.json({ metrics: { products, customers, orders, paidSales: sales._sum.total || 0, lowStock }, recentOrders });
  } catch (e) { next(e); }
});

router.get('/products', async (req, res, next) => {
  try { res.json(await prisma.product.findMany({ where: { tenantId: req.tenant.id }, include: { category: true }, orderBy: { createdAt: 'desc' } })); } catch(e) { next(e); }
});
router.post('/products', requireOwner, async (req, res, next) => {
  try {
    const d = z.object({ name: z.string().min(1), sku: z.string().optional().nullable(), categoryId: z.string().optional().nullable(), description: z.string().optional(), costPrice: z.coerce.number().min(0), sellingPrice: z.coerce.number().min(0), stock: z.coerce.number().int().min(0), lowStockAt: z.coerce.number().int().min(0).default(5) }).parse(req.body);
    if (d.categoryId) {
      const category = await prisma.category.findFirst({ where: { id: d.categoryId, tenantId: req.tenant.id } });
      if (!category) return res.status(400).json({ message: 'Invalid category' });
    }
    const p = await prisma.product.create({ data: { ...d, tenantId: req.tenant.id, movements: d.stock ? { create: { tenantId: req.tenant.id, type: 'IN', quantity: d.stock, note: 'Opening stock' } } : undefined } });
    res.status(201).json(p);
  } catch(e) { next(e); }
});
router.patch('/products/:id', requireOwner, async (req, res, next) => {
  try {
    const d = z.object({ name: z.string().min(1).optional(), sku: z.string().nullable().optional(), description: z.string().optional(), costPrice: z.coerce.number().min(0).optional(), sellingPrice: z.coerce.number().min(0).optional(), lowStockAt: z.coerce.number().int().min(0).optional(), isActive: z.boolean().optional() }).parse(req.body);
    const found = await prisma.product.findFirst({ where: { id: req.params.id, tenantId: req.tenant.id } });
    if (!found) return res.status(404).json({ message: 'Product not found' });
    res.json(await prisma.product.update({ where: { id: found.id }, data: d }));
  } catch(e) { next(e); }
});
router.delete('/products/:id', requireOwner, async (req, res, next) => {
  try {
    const found = await prisma.product.findFirst({ where: { id: req.params.id, tenantId: req.tenant.id } });
    if (!found) return res.status(404).json({ message: 'Product not found' });
    await prisma.product.update({ where: { id: found.id }, data: { isActive: false } });
    res.json({ message: 'Product archived' });
  } catch(e) { next(e); }
});

router.get('/categories', async (req, res, next) => {
  try { res.json(await prisma.category.findMany({ where: { tenantId: req.tenant.id }, orderBy: { name: 'asc' } })); } catch(e) { next(e); }
});
router.post('/categories', requireOwner, async (req, res, next) => {
  try {
    const d = z.object({ name: z.string().min(1) }).parse(req.body);
    res.status(201).json(await prisma.category.create({ data: { ...d, tenantId: req.tenant.id } }));
  } catch(e) { next(e); }
});

router.get('/customers', async (req, res, next) => {
  try { res.json(await prisma.customer.findMany({ where: { tenantId: req.tenant.id }, orderBy: { createdAt: 'desc' } })); } catch(e) { next(e); }
});
router.post('/customers', requireOwner, async (req, res, next) => {
  try {
    const d = z.object({ name: z.string().min(1), phone: z.string().optional(), email: z.string().email().optional().or(z.literal('')), address: z.string().optional(), note: z.string().optional() }).parse(req.body);
    res.status(201).json(await prisma.customer.create({ data: { ...d, tenantId: req.tenant.id } }));
  } catch(e) { next(e); }
});
router.patch('/customers/:id', requireOwner, async (req, res, next) => {
  try {
    const found = await prisma.customer.findFirst({ where: { id: req.params.id, tenantId: req.tenant.id } });
    if (!found) return res.status(404).json({ message: 'Customer not found' });
    const d = z.object({ name: z.string().min(1).optional(), phone: z.string().optional(), address: z.string().optional(), note: z.string().optional() }).parse(req.body);
    res.json(await prisma.customer.update({ where: { id: found.id }, data: d }));
  } catch(e) { next(e); }
});

router.get('/orders', async (req, res, next) => {
  try { res.json(await prisma.order.findMany({ where: { tenantId: req.tenant.id }, include: { customer: true, items: true }, orderBy: { createdAt: 'desc' } })); } catch(e) { next(e); }
});
router.post('/orders', requireOwner, async (req, res, next) => {
  try {
    const d = z.object({ customerId: z.string().optional().nullable(), discount: z.coerce.number().min(0).default(0), deliveryFee: z.coerce.number().min(0).default(0), paymentMethod: z.string().optional(), note: z.string().optional(), items: z.array(z.object({ productId: z.string(), quantity: z.coerce.number().int().positive() })).min(1) }).parse(req.body);
    const result = await prisma.$transaction(async tx => {
      if (d.customerId && !await tx.customer.findFirst({ where: { id: d.customerId, tenantId: req.tenant.id } })) throw Object.assign(new Error('Invalid customer'), { status: 400 });
      const ids = d.items.map(i => i.productId);
      const products = await tx.product.findMany({ where: { id: { in: ids }, tenantId: req.tenant.id, isActive: true } });
      if (products.length !== new Set(ids).size) throw Object.assign(new Error('One or more products are invalid'), { status: 400 });
      let subtotal = 0;
      const rows = d.items.map(i => {
        const p = products.find(x => x.id === i.productId);
        if (p.stock < i.quantity) throw Object.assign(new Error(`Insufficient stock: ${p.name}`), { status: 400 });
        const price = Number(p.sellingPrice), cost = Number(p.costPrice), line = price * i.quantity;
        subtotal += line;
        return { productId: p.id, productName: p.name, quantity: i.quantity, unitPrice: price, unitCost: cost, lineTotal: line };
      });
      const total = Math.max(0, subtotal - d.discount + d.deliveryFee);
      const orderNumber = `SF-${Date.now()}-${Math.floor(Math.random()*1000)}`;
      const order = await tx.order.create({ data: { tenantId: req.tenant.id, customerId: d.customerId || null, orderNumber, subtotal, discount: d.discount, deliveryFee: d.deliveryFee, total, paymentMethod: d.paymentMethod, note: d.note, items: { create: rows } }, include: { items: true, customer: true } });
      for (const row of rows) {
        await tx.product.update({ where: { id: row.productId }, data: { stock: { decrement: row.quantity } } });
        await tx.inventoryMovement.create({ data: { tenantId: req.tenant.id, productId: row.productId, type: 'OUT', quantity: row.quantity, note: `Order ${orderNumber}` } });
      }
      return order;
    }, { isolationLevel: 'Serializable' });
    res.status(201).json(result);
  } catch(e) { next(e); }
});
router.patch('/orders/:id/status', requireOwner, async (req, res, next) => {
  try {
    const d = z.object({ status: z.enum(['PENDING','CONFIRMED','PACKING','SHIPPED','DELIVERED','CANCELLED']), paymentStatus: z.enum(['UNPAID','PARTIAL','PAID','REFUNDED']).optional() }).parse(req.body);
    const order = await prisma.order.findFirst({ where: { id: req.params.id, tenantId: req.tenant.id }, include: { items: true } });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status === 'CANCELLED' && d.status !== 'CANCELLED') return res.status(400).json({ message: 'Cancelled order cannot be reopened' });
    const updated = await prisma.$transaction(async tx => {
      if (d.status === 'CANCELLED' && order.status !== 'CANCELLED') {
        for (const item of order.items) {
          await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
          await tx.inventoryMovement.create({ data: { tenantId: req.tenant.id, productId: item.productId, type: 'IN', quantity: item.quantity, note: `Cancel ${order.orderNumber}` } });
        }
      }
      return tx.order.update({ where: { id: order.id }, data: { status: d.status, ...(d.paymentStatus ? { paymentStatus: d.paymentStatus } : {}) } });
    });
    res.json(updated);
  } catch(e) { next(e); }
});

router.get('/inventory', async (req, res, next) => {
  try {
    const [products, movements] = await Promise.all([
      prisma.product.findMany({ where: { tenantId: req.tenant.id, isActive: true }, select: { id: true, name: true, sku: true, stock: true, lowStockAt: true } }),
      prisma.inventoryMovement.findMany({ where: { tenantId: req.tenant.id }, include: { product: true }, orderBy: { createdAt: 'desc' }, take: 30 })
    ]);
    res.json({ products, movements });
  } catch(e) { next(e); }
});
router.get('/reports/summary', async (req, res, next) => {
  try {
    const t = req.tenant.id;
    const [orders, paid, products] = await Promise.all([
      prisma.order.count({ where: { tenantId: t } }),
      prisma.order.aggregate({ where: { tenantId: t, paymentStatus: 'PAID' }, _sum: { total: true } }),
      prisma.product.findMany({ where: { tenantId: t }, select: { costPrice: true, sellingPrice: true, stock: true } })
    ]);
    res.json({ orders, paidRevenue: paid._sum.total || 0, inventoryCostValue: products.reduce((s,p)=>s+Number(p.costPrice)*p.stock,0), inventoryRetailValue: products.reduce((s,p)=>s+Number(p.sellingPrice)*p.stock,0) });
  } catch(e) { next(e); }
});
router.get('/subscriptions/plans', async (req, res, next) => {
  try { res.json(await prisma.plan.findMany({ orderBy: { priceMonthly: 'asc' } })); } catch(e) { next(e); }
});
router.get('/subscriptions/current', async (req, res, next) => {
  try { res.json(await prisma.subscription.findUnique({ where: { tenantId: req.tenant.id }, include: { plan: true } })); } catch(e) { next(e); }
});
router.get('/admin/overview', async (req, res, next) => {
  try {
    if (!req.user.isPlatformAdmin) return res.status(403).json({ message: 'Platform admin only' });
    const [tenants, users, orders] = await Promise.all([prisma.tenant.count(), prisma.user.count(), prisma.order.count()]);
    res.json({ tenants, users, orders });
  } catch(e) { next(e); }
});
export default router;
