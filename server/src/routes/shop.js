import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireOwner, requirePermission } from '../middleware/auth.js';

const router = Router();

function formatProduct(p) {
  const v = p.ProductVariant?.[0];
  const stock = (p.ProductVariant || []).reduce((sum, item) => sum + (item.stock || 0), 0);
  return {
    id: p.id,
    tenantId: p.tenantId,
    categoryId: p.categoryId,
    name: p.name,
    sku: p.sku,
    description: p.description,
    isActive: p.isActive,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    category: p.Category || null,
    variantId: v?.id || null,
    variantName: v?.name || 'Default',
    costPrice: Number(v?.costPrice ?? 0),
    sellingPrice: Number(v?.sellingPrice ?? 0),
    stock,
    lowStockAt: 5
  };
}

function formatOrder(o) {
  return {
    ...o,
    subtotal: Number(o.subtotal || 0),
    discount: Number(o.discount || 0),
    deliveryFee: Number(o.deliveryFee || 0),
    total: Number(o.total || 0),
    status: (o.status || 'PENDING').toUpperCase(),
    paymentStatus: (o.paymentStatus || 'UNPAID').toUpperCase(),
    paymentMethod: o.paymentMethod || 'CASH',
    customer: o.Customer || null,
    branch: o.Branch || null,
    items: (o.OrderItem || []).map(i => ({
      ...i,
      unitPrice: Number(i.unitPrice || 0),
      unitCost: Number(i.unitCost || 0),
      total: Number(i.total || 0)
    }))
  };
}

// -------------------------------------------------------------
// 1. DASHBOARD OVERVIEW (Real DB Data)
// -------------------------------------------------------------
router.get('/dashboard', async (req, res, next) => {
  try {
    const t = req.tenant.id;
    const now = new Date();

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      allProducts,
      totalCustomers,
      totalOrders,
      todayOrders,
      monthOrders,
      recentOrdersRaw,
      monthExpenses,
      recentMovements
    ] = await Promise.all([
      prisma.product.findMany({
        where: { tenantId: t, isActive: true },
        include: { Category: true, ProductVariant: true }
      }),
      prisma.customer.count({ where: { tenantId: t } }),
      prisma.order.count({ where: { tenantId: t } }),
      prisma.order.findMany({
        where: {
          tenantId: t,
          createdAt: { gte: startOfToday },
          status: { notIn: ['CANCELLED', 'cancelled'] }
        },
        include: { OrderItem: true }
      }),
      prisma.order.findMany({
        where: {
          tenantId: t,
          createdAt: { gte: startOfMonth },
          status: { notIn: ['CANCELLED', 'cancelled'] }
        },
        include: { OrderItem: true }
      }),
      prisma.order.findMany({
        where: { tenantId: t },
        include: { Customer: true, OrderItem: true },
        orderBy: { createdAt: 'desc' },
        take: 6
      }),
      prisma.expense.findMany({
        where: { tenantId: t, createdAt: { gte: startOfMonth } }
      }),
      prisma.inventoryMovement.findMany({
        where: { ProductVariant: { Product: { tenantId: t } } },
        include: { ProductVariant: { include: { Product: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5
      })
    ]);

    const formattedProducts = allProducts.map(formatProduct);
    const totalStock = formattedProducts.reduce((sum, p) => sum + p.stock, 0);
    const lowStockProducts = formattedProducts.filter(p => p.stock <= p.lowStockAt);

    // Today & Month Sales Calculations
    const todaySales = todayOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const monthSales = monthOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

    // Calculate COGS and Gross Profit for This Month
    let monthCOGS = 0;
    for (const order of monthOrders) {
      for (const item of order.OrderItem) {
        monthCOGS += item.quantity * Number(item.unitCost || 0);
      }
    }
    const monthGrossProfit = monthSales - monthCOGS;
    const totalExpenses = monthExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const netProfit = monthGrossProfit - totalExpenses;

    // 7-day Sales Chart Data
    const chartDays = 7;
    const chartMap = {};
    for (let i = chartDays - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      chartMap[key] = { date: key, label: `${d.getMonth() + 1}/${d.getDate()}`, sales: 0, orders: 0 };
    }

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - (chartDays - 1));
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const pastWeekOrders = await prisma.order.findMany({
      where: {
        tenantId: t,
        createdAt: { gte: sevenDaysAgo },
        status: { notIn: ['CANCELLED', 'cancelled'] }
      },
      select: { createdAt: true, total: true }
    });

    for (const ord of pastWeekOrders) {
      const d = new Date(ord.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (chartMap[key]) {
        chartMap[key].sales += Number(ord.total || 0);
        chartMap[key].orders += 1;
      }
    }

    // Top Selling Products
    const allOrderItems = await prisma.orderItem.findMany({
      where: {
        Order: {
          tenantId: t,
          status: { notIn: ['CANCELLED', 'cancelled'] }
        }
      }
    });

    const productSalesMap = {};
    for (const item of allOrderItems) {
      const key = item.productName;
      if (!productSalesMap[key]) {
        productSalesMap[key] = { name: item.productName, quantity: 0, totalSales: 0 };
      }
      productSalesMap[key].quantity += item.quantity;
      productSalesMap[key].totalSales += Number(item.total || 0);
    }
    const topProducts = Object.values(productSalesMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    res.json({
      metrics: {
        todaySales,
        monthSales,
        totalOrders,
        totalProducts: formattedProducts.length,
        totalCustomers,
        totalStock,
        lowStock: lowStockProducts.length,
        totalExpenses,
        netProfit,
        monthCOGS,
        monthGrossProfit
      },
      lowStockProducts: lowStockProducts.slice(0, 6),
      recentOrders: recentOrdersRaw.map(formatOrder),
      chartData: Object.values(chartMap),
      topProducts,
      recentMovements: recentMovements.map(m => ({
        id: m.id,
        type: m.type,
        quantity: m.quantity,
        note: m.note,
        createdAt: m.createdAt,
        productName: m.ProductVariant?.Product?.name || 'Product'
      }))
    });
  } catch (e) {
    next(e);
  }
});

// -------------------------------------------------------------
// 2. PRODUCT MANAGEMENT (Validated SKU, Categories, Variants)
// -------------------------------------------------------------
router.get('/products', async (req, res, next) => {
  try {
    const { categoryId, search } = req.query;
    const where = { tenantId: req.tenant.id, isActive: true };

    if (categoryId) where.categoryId = categoryId;
    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { sku: { contains: search.trim(), mode: 'insensitive' } }
      ];
    }

    const rows = await prisma.product.findMany({
      where,
      include: { Category: true, ProductVariant: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(rows.map(formatProduct));
  } catch (e) {
    next(e);
  }
});

router.post('/products', requirePermission('inventory'), async (req, res, next) => {
  try {
    const d = z.object({
      name: z.string().min(1, 'Product name is required'),
      sku: z.string().optional().nullable(),
      categoryId: z.string().optional().nullable(),
      description: z.string().optional().nullable(),
      costPrice: z.coerce.number().min(0).default(0),
      sellingPrice: z.coerce.number().min(0).default(0),
      stock: z.coerce.number().int().min(0).default(0),
      lowStockAt: z.coerce.number().int().min(0).default(5)
    }).parse(req.body);

    const baseSku = (d.sku && d.sku.trim())
      ? d.sku.trim()
      : `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Validate duplicate SKU in this tenant
    const existingSku = await prisma.product.findFirst({
      where: {
        tenantId: req.tenant.id,
        sku: baseSku
      }
    });

    if (existingSku) {
      return res.status(409).json({
        message: `Product SKU '${baseSku}' is already in use in your shop. Please use a unique SKU.`
      });
    }

    if (d.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: d.categoryId, tenantId: req.tenant.id }
      });
      if (!category) return res.status(400).json({ message: 'Selected category does not exist' });
    }

    const branch = req.branch || await prisma.branch.findFirst({
      where: { tenantId: req.tenant.id, isActive: true }
    });

    const variantSku = `${baseSku}-VAR-${Math.floor(Math.random() * 10000)}`;

    const created = await prisma.$transaction(async tx => {
      const p = await tx.product.create({
        data: {
          tenantId: req.tenant.id,
          categoryId: d.categoryId || null,
          name: d.name,
          sku: baseSku,
          description: d.description || null,
          isActive: true
        }
      });

      const variant = await tx.productVariant.create({
        data: {
          productId: p.id,
          name: 'Standard',
          sku: variantSku,
          costPrice: d.costPrice,
          sellingPrice: d.sellingPrice,
          stock: d.stock
        }
      });

      if (branch) {
        await tx.branchStock.create({
          data: {
            branchId: branch.id,
            variantId: variant.id,
            quantity: d.stock
          }
        });
      }

      if (d.stock > 0) {
        await tx.inventoryMovement.create({
          data: {
            variantId: variant.id,
            branchId: branch?.id || null,
            type: 'IN',
            quantity: d.stock,
            note: 'Initial stock intake'
          }
        });
      }

      return tx.product.findUnique({
        where: { id: p.id },
        include: { Category: true, ProductVariant: true }
      });
    });

    res.status(201).json(formatProduct(created));
  } catch (e) {
    next(e);
  }
});

router.patch('/products/:id', requirePermission('inventory'), async (req, res, next) => {
  try {
    const d = z.object({
      name: z.string().min(1).optional(),
      sku: z.string().min(1).optional(),
      categoryId: z.string().optional().nullable(),
      description: z.string().optional().nullable(),
      costPrice: z.coerce.number().min(0).optional(),
      sellingPrice: z.coerce.number().min(0).optional(),
      stock: z.coerce.number().int().min(0).optional(),
      isActive: z.boolean().optional()
    }).parse(req.body);

    const found = await prisma.product.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
      include: { ProductVariant: true }
    });
    if (!found) return res.status(404).json({ message: 'Product not found' });

    // If changing SKU, check uniqueness
    if (d.sku && d.sku !== found.sku) {
      const dup = await prisma.product.findFirst({
        where: { tenantId: req.tenant.id, sku: d.sku, id: { not: found.id } }
      });
      if (dup) return res.status(409).json({ message: `SKU '${d.sku}' is already in use by another product` });
    }

    const updated = await prisma.$transaction(async tx => {
      await tx.product.update({
        where: { id: found.id },
        data: {
          ...(d.name !== undefined ? { name: d.name } : {}),
          ...(d.sku !== undefined ? { sku: d.sku } : {}),
          ...(d.categoryId !== undefined ? { categoryId: d.categoryId } : {}),
          ...(d.description !== undefined ? { description: d.description } : {}),
          ...(d.isActive !== undefined ? { isActive: d.isActive } : {})
        }
      });

      const v = found.ProductVariant?.[0];
      if (v) {
        const updateVariant = {};
        if (d.costPrice !== undefined) updateVariant.costPrice = d.costPrice;
        if (d.sellingPrice !== undefined) updateVariant.sellingPrice = d.sellingPrice;
        if (d.stock !== undefined) {
          const diff = d.stock - v.stock;
          updateVariant.stock = d.stock;

          if (diff !== 0) {
            await tx.inventoryMovement.create({
              data: {
                variantId: v.id,
                branchId: req.branch?.id || null,
                type: diff > 0 ? 'IN' : 'OUT',
                quantity: Math.abs(diff),
                note: 'Manual stock update'
              }
            });
          }
        }

        if (Object.keys(updateVariant).length > 0) {
          await tx.productVariant.update({
            where: { id: v.id },
            data: updateVariant
          });
        }
      }

      return tx.product.findUnique({
        where: { id: found.id },
        include: { Category: true, ProductVariant: true }
      });
    });

    res.json(formatProduct(updated));
  } catch (e) {
    next(e);
  }
});

router.delete('/products/:id', requirePermission('inventory'), async (req, res, next) => {
  try {
    const found = await prisma.product.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id }
    });
    if (!found) return res.status(404).json({ message: 'Product not found' });

    await prisma.product.update({
      where: { id: found.id },
      data: { isActive: false }
    });

    res.json({ message: 'Product archived successfully' });
  } catch (e) {
    next(e);
  }
});

// -------------------------------------------------------------
// 3. CATEGORY MANAGEMENT
// -------------------------------------------------------------
router.get('/categories', async (req, res, next) => {
  try {
    const cats = await prisma.category.findMany({
      where: { tenantId: req.tenant.id },
      include: { _count: { select: { Product: true } } },
      orderBy: { name: 'asc' }
    });
    res.json(cats.map(c => ({
      id: c.id,
      name: c.name,
      createdAt: c.createdAt,
      productsCount: c._count.Product
    })));
  } catch (e) {
    next(e);
  }
});

router.post('/categories', requirePermission('inventory'), async (req, res, next) => {
  try {
    const d = z.object({ name: z.string().min(1, 'Category name is required') }).parse(req.body);
    const existing = await prisma.category.findFirst({
      where: { tenantId: req.tenant.id, name: { equals: d.name.trim(), mode: 'insensitive' } }
    });
    if (existing) {
      return res.status(409).json({ message: 'Category name already exists' });
    }

    const created = await prisma.category.create({
      data: { tenantId: req.tenant.id, name: d.name.trim() }
    });
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

router.delete('/categories/:id', requirePermission('inventory'), async (req, res, next) => {
  try {
    const cat = await prisma.category.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id }
    });
    if (!cat) return res.status(404).json({ message: 'Category not found' });

    await prisma.category.delete({ where: { id: cat.id } });
    res.json({ message: 'Category deleted' });
  } catch (e) {
    next(e);
  }
});

// -------------------------------------------------------------
// 4. BRANCH MANAGEMENT
// -------------------------------------------------------------
router.get('/branches', async (req, res, next) => {
  try {
    const branches = await prisma.branch.findMany({
      where: { tenantId: req.tenant.id },
      include: {
        _count: { select: { Order: true, TenantUser: true } }
      },
      orderBy: { createdAt: 'asc' }
    });
    res.json(branches);
  } catch (e) {
    next(e);
  }
});

router.post('/branches', requireOwner, async (req, res, next) => {
  try {
    const d = z.object({
      name: z.string().min(1),
      address: z.string().optional().nullable(),
      phone: z.string().optional().nullable(),
      isMain: z.boolean().default(false)
    }).parse(req.body);

    const branch = await prisma.branch.create({
      data: {
        tenantId: req.tenant.id,
        name: d.name,
        address: d.address || null,
        phone: d.phone || null,
        isMain: d.isMain,
        isActive: true
      }
    });

    res.status(201).json(branch);
  } catch (e) {
    next(e);
  }
});

// -------------------------------------------------------------
// 5. STAFF & ROLES / PERMISSION MANAGEMENT
// -------------------------------------------------------------
router.get('/staff', requireOwner, async (req, res, next) => {
  try {
    const staffList = await prisma.tenantUser.findMany({
      where: { tenantId: req.tenant.id },
      include: {
        User: { select: { id: true, name: true, email: true, createdAt: true } },
        Branch: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'asc' }
    });
    res.json(staffList);
  } catch (e) {
    next(e);
  }
});

router.post('/staff', requireOwner, async (req, res, next) => {
  try {
    const d = z.object({
      name: z.string().min(2),
      email: z.string().email().transform(v => v.toLowerCase().trim()),
      password: z.string().min(6),
      role: z.enum(['owner', 'manager', 'cashier', 'staff']).default('cashier'),
      branchId: z.string().optional().nullable(),
      permissions: z.object({
        pos: z.boolean().default(true),
        inventory: z.boolean().default(false),
        orders: z.boolean().default(true),
        customers: z.boolean().default(false),
        reports: z.boolean().default(false),
        manageStaff: z.boolean().default(false)
      }).optional()
    }).parse(req.body);

    // Check if user exists or create
    let user = await prisma.user.findUnique({ where: { email: d.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: d.name,
          email: d.email,
          password: await bcrypt.hash(d.password, 12),
          isPlatformAdmin: false
        }
      });
    } else {
      // If user exists, update password and name as specified by the admin
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: d.name,
          password: await bcrypt.hash(d.password, 12)
        }
      });
    }

    // Check if user already in this tenant
    const existingMembership = await prisma.tenantUser.findUnique({
      where: {
        tenantId_userId: {
          tenantId: req.tenant.id,
          userId: user.id
        }
      }
    });
    if (existingMembership) {
      return res.status(409).json({ message: 'This user is already a staff member in your shop' });
    }

    const defaultPerms = d.role === 'owner'
      ? { pos: true, inventory: true, orders: true, customers: true, reports: true, manageStaff: true }
      : d.role === 'manager'
        ? { pos: true, inventory: true, orders: true, customers: true, reports: true, manageStaff: false }
        : { pos: true, inventory: false, orders: true, customers: false, reports: false, manageStaff: false };

    const membership = await prisma.tenantUser.create({
      data: {
        tenantId: req.tenant.id,
        userId: user.id,
        branchId: d.branchId || null,
        role: d.role,
        permissions: d.permissions || defaultPerms
      },
      include: {
        User: { select: { id: true, name: true, email: true } },
        Branch: true
      }
    });

    res.status(201).json(membership);
  } catch (e) {
    next(e);
  }
});

router.patch('/staff/:id', requireOwner, async (req, res, next) => {
  try {
    const d = z.object({
      name: z.string().min(2).optional(),
      email: z.string().email().optional(),
      password: z.string().min(6).optional(),
      role: z.enum(['owner', 'manager', 'cashier', 'staff']).optional(),
      branchId: z.string().optional().nullable(),
      permissions: z.record(z.boolean()).optional()
    }).parse(req.body);

    const membership = await prisma.tenantUser.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
      include: { User: true }
    });
    if (!membership) return res.status(404).json({ message: 'Staff record not found' });

    // Update underlying User info (name, email, password) if provided
    const userUpdate = {};
    if (d.name) userUpdate.name = d.name;
    if (d.email) {
      const email = d.email.toLowerCase().trim();
      if (email !== membership.User.email) {
        const dup = await prisma.user.findUnique({ where: { email } });
        if (dup) return res.status(409).json({ message: 'Email address is already in use' });
      }
      userUpdate.email = email;
    }
    if (d.password && d.password.trim()) {
      userUpdate.password = await bcrypt.hash(d.password.trim(), 12);
    }
    if (Object.keys(userUpdate).length > 0) {
      await prisma.user.update({
        where: { id: membership.userId },
        data: userUpdate
      });
    }

    const updated = await prisma.tenantUser.update({
      where: { id: membership.id },
      data: {
        ...(d.role ? { role: d.role } : {}),
        ...(d.branchId !== undefined ? { branchId: d.branchId } : {}),
        ...(d.permissions ? { permissions: d.permissions } : {})
      },
      include: { User: { select: { id: true, name: true, email: true } }, Branch: true }
    });

    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// Reset Staff Password Endpoint (for Shop Admin)
router.post('/staff/:id/reset-password', requireOwner, async (req, res, next) => {
  try {
    const { password } = z.object({
      password: z.string().min(6, 'Password must be at least 6 characters')
    }).parse(req.body);

    const membership = await prisma.tenantUser.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
      include: { User: true }
    });
    if (!membership) return res.status(404).json({ message: 'Staff member not found' });

    const hashedPassword = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: membership.userId },
      data: { password: hashedPassword }
    });

    res.json({
      message: `Password for ${membership.User.name} (${membership.User.email}) reset successfully`
    });
  } catch (e) {
    next(e);
  }
});

router.delete('/staff/:id', requireOwner, async (req, res, next) => {
  try {
    const membership = await prisma.tenantUser.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id }
    });
    if (!membership) return res.status(404).json({ message: 'Staff not found' });

    // Protect against deleting the only owner
    if (membership.role === 'owner') {
      const ownersCount = await prisma.tenantUser.count({
        where: { tenantId: req.tenant.id, role: 'owner' }
      });
      if (ownersCount <= 1) {
        return res.status(400).json({ message: 'Cannot remove the sole owner of the shop' });
      }
    }

    await prisma.tenantUser.delete({ where: { id: membership.id } });
    res.json({ message: 'Staff member removed' });
  } catch (e) {
    next(e);
  }
});

// -------------------------------------------------------------
// 6. CUSTOMER MANAGEMENT
// -------------------------------------------------------------
router.get('/customers', async (req, res, next) => {
  try {
    const { search } = req.query;
    const where = { tenantId: req.tenant.id };
    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { phone: { contains: search.trim(), mode: 'insensitive' } }
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      include: {
        _count: { select: { Order: true } },
        Order: { select: { total: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(customers.map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone || '—',
      address: c.address || '—',
      createdAt: c.createdAt,
      ordersCount: c._count.Order,
      totalSpent: c.Order.reduce((sum, o) => sum + Number(o.total || 0), 0)
    })));
  } catch (e) {
    next(e);
  }
});

router.post('/customers', requirePermission('customers'), async (req, res, next) => {
  try {
    const d = z.object({
      name: z.string().min(1, 'Customer name is required'),
      phone: z.string().optional().nullable(),
      address: z.string().optional().nullable()
    }).parse(req.body);

    const customer = await prisma.customer.create({
      data: {
        tenantId: req.tenant.id,
        name: d.name,
        phone: d.phone || null,
        address: d.address || null
      }
    });
    res.status(201).json(customer);
  } catch (e) {
    next(e);
  }
});

router.patch('/customers/:id', requirePermission('customers'), async (req, res, next) => {
  try {
    const d = z.object({
      name: z.string().min(1).optional(),
      phone: z.string().optional().nullable(),
      address: z.string().optional().nullable()
    }).parse(req.body);

    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id }
    });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    const updated = await prisma.customer.update({
      where: { id: customer.id },
      data: d
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// -------------------------------------------------------------
// 7. ORDERS & POS SALES (With Stock Deduction)
// -------------------------------------------------------------
router.get('/orders', async (req, res, next) => {
  try {
    const { status, paymentStatus, search } = req.query;
    const where = { tenantId: req.tenant.id };

    if (status && status !== 'all') where.status = status;
    if (paymentStatus && paymentStatus !== 'all') where.paymentStatus = paymentStatus;
    if (search && search.trim()) {
      where.OR = [
        { orderNumber: { contains: search.trim(), mode: 'insensitive' } },
        { Customer: { name: { contains: search.trim(), mode: 'insensitive' } } }
      ];
    }

    const rows = await prisma.order.findMany({
      where,
      include: { Customer: true, OrderItem: true, Branch: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json(rows.map(formatOrder));
  } catch (e) {
    next(e);
  }
});

router.post('/orders', requirePermission('pos'), async (req, res, next) => {
  try {
    const d = z.object({
      customerId: z.string().optional().nullable(),
      discount: z.coerce.number().min(0).default(0),
      deliveryFee: z.coerce.number().min(0).default(0),
      paymentMethod: z.string().default('CASH'),
      shippingAddress: z.string().optional().nullable(),
      items: z.array(z.object({
        productId: z.string(),
        quantity: z.coerce.number().int().positive()
      })).min(1, 'Order must contain at least 1 item')
    }).parse(req.body);

    const result = await prisma.$transaction(async tx => {
      // Validate customer if provided
      if (d.customerId) {
        const cust = await tx.customer.findFirst({
          where: { id: d.customerId, tenantId: req.tenant.id }
        });
        if (!cust) throw Object.assign(new Error('Selected customer not found'), { status: 400 });
      }

      const productIds = d.items.map(i => i.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, tenantId: req.tenant.id, isActive: true },
        include: { ProductVariant: true }
      });

      if (products.length !== new Set(productIds).size) {
        throw Object.assign(new Error('One or more selected products are invalid or inactive'), { status: 400 });
      }

      let subtotal = 0;
      const orderItemRows = [];

      for (const item of d.items) {
        const prod = products.find(p => p.id === item.productId);
        const variant = prod.ProductVariant?.[0];

        if (!variant) {
          throw Object.assign(new Error(`Product variant missing for ${prod.name}`), { status: 400 });
        }
        if (variant.stock < item.quantity) {
          throw Object.assign(
            new Error(`Insufficient stock for '${prod.name}'. In stock: ${variant.stock}, Requested: ${item.quantity}`),
            { status: 400 }
          );
        }

        const price = Number(variant.sellingPrice);
        const cost = Number(variant.costPrice);
        const lineTotal = price * item.quantity;
        subtotal += lineTotal;

        orderItemRows.push({
          variantId: variant.id,
          productName: prod.name,
          variantName: variant.name,
          quantity: item.quantity,
          unitPrice: price,
          unitCost: cost,
          total: lineTotal
        });
      }

      const total = Math.max(0, subtotal - d.discount + d.deliveryFee);
      const orderNumber = `SF-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

      const branch = req.branch || await tx.branch.findFirst({
        where: { tenantId: req.tenant.id, isActive: true }
      });

      const order = await tx.order.create({
        data: {
          tenantId: req.tenant.id,
          branchId: branch?.id || null,
          customerId: d.customerId || null,
          orderNumber,
          subtotal,
          discount: d.discount,
          deliveryFee: d.deliveryFee,
          total,
          status: 'CONFIRMED',
          paymentStatus: 'PAID',
          paymentMethod: d.paymentMethod,
          shippingAddress: d.shippingAddress || null,
          OrderItem: { create: orderItemRows }
        },
        include: { OrderItem: true, Customer: true, Branch: true }
      });

      // Deduct stock & log inventory movement
      for (const row of orderItemRows) {
        await tx.productVariant.update({
          where: { id: row.variantId },
          data: { stock: { decrement: row.quantity } }
        });

        if (branch) {
          await tx.branchStock.updateMany({
            where: { branchId: branch.id, variantId: row.variantId },
            data: { quantity: { decrement: row.quantity } }
          });
        }

        await tx.inventoryMovement.create({
          data: {
            variantId: row.variantId,
            branchId: branch?.id || null,
            type: 'OUT',
            quantity: row.quantity,
            note: `POS Sale Order ${orderNumber}`
          }
        });
      }

      return formatOrder(order);
    });

    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
});

router.patch('/orders/:id/status', requirePermission('orders'), async (req, res, next) => {
  try {
    const d = z.object({
      status: z.enum(['PENDING', 'CONFIRMED', 'PACKING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
      paymentStatus: z.enum(['UNPAID', 'PARTIAL', 'PAID', 'REFUNDED']).optional()
    }).parse(req.body);

    const order = await prisma.order.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
      include: { OrderItem: true, Customer: true, Branch: true }
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const currentStatus = (order.status || '').toUpperCase();
    if (currentStatus === 'CANCELLED' && d.status !== 'CANCELLED') {
      return res.status(400).json({ message: 'A cancelled order cannot be reopened' });
    }

    const updated = await prisma.$transaction(async tx => {
      // If cancelling order, restore inventory
      if (d.status === 'CANCELLED' && currentStatus !== 'CANCELLED') {
        for (const item of order.OrderItem) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.quantity } }
          });

          if (order.branchId) {
            await tx.branchStock.updateMany({
              where: { branchId: order.branchId, variantId: item.variantId },
              data: { quantity: { increment: item.quantity } }
            });
          }

          await tx.inventoryMovement.create({
            data: {
              variantId: item.variantId,
              branchId: order.branchId || null,
              type: 'IN',
              quantity: item.quantity,
              note: `Restocked on Cancel Order #${order.orderNumber}`
            }
          });
        }
      }

      return tx.order.update({
        where: { id: order.id },
        data: {
          status: d.status,
          ...(d.paymentStatus ? { paymentStatus: d.paymentStatus } : d.status === 'CANCELLED' ? { paymentStatus: 'REFUNDED' } : {})
        },
        include: { OrderItem: true, Customer: true, Branch: true }
      });
    });

    res.json(formatOrder(updated));
  } catch (e) {
    next(e);
  }
});

// -------------------------------------------------------------
// 8. EXPENSE MANAGEMENT
// -------------------------------------------------------------
router.get('/expenses', async (req, res, next) => {
  try {
    const expenses = await prisma.expense.findMany({
      where: { tenantId: req.tenant.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json(expenses.map(e => ({
      id: e.id,
      title: e.title,
      amount: Number(e.amount),
      description: e.description || '',
      createdAt: e.createdAt
    })));
  } catch (e) {
    next(e);
  }
});

router.post('/expenses', requirePermission('reports'), async (req, res, next) => {
  try {
    const d = z.object({
      title: z.string().min(1, 'Expense title is required'),
      amount: z.coerce.number().positive('Amount must be greater than 0'),
      description: z.string().optional().nullable(),
      createdAt: z.string().datetime().or(z.string()).optional()
    }).parse(req.body);

    const expense = await prisma.expense.create({
      data: {
        tenantId: req.tenant.id,
        title: d.title,
        amount: d.amount,
        description: d.description || null,
        createdAt: d.createdAt ? new Date(d.createdAt) : new Date()
      }
    });

    res.status(201).json({
      ...expense,
      amount: Number(expense.amount)
    });
  } catch (e) {
    next(e);
  }
});

router.delete('/expenses/:id', requirePermission('reports'), async (req, res, next) => {
  try {
    const found = await prisma.expense.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id }
    });
    if (!found) return res.status(404).json({ message: 'Expense record not found' });

    await prisma.expense.delete({ where: { id: found.id } });
    res.json({ message: 'Expense deleted' });
  } catch (e) {
    next(e);
  }
});

// -------------------------------------------------------------
// 9. SALES & PROFIT & LOSS REPORTS
// -------------------------------------------------------------
router.get('/reports/sales', async (req, res, next) => {
  try {
    const { range, startDate, endDate } = req.query;
    const now = new Date();

    let start = new Date(now);
    let end = new Date(now);
    end.setHours(23, 59, 59, 999);

    if (range === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (range === '7days') {
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
    } else if (range === '30days') {
      start.setDate(now.getDate() - 29);
      start.setHours(0, 0, 0, 0);
    } else if (range === 'thisMonth') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (startDate && endDate) {
      start = new Date(`${startDate}T00:00:00`);
      end = new Date(`${endDate}T23:59:59.999`);
    } else {
      start.setDate(now.getDate() - 29);
      start.setHours(0, 0, 0, 0);
    }

    const orders = await prisma.order.findMany({
      where: {
        tenantId: req.tenant.id,
        createdAt: { gte: start, lte: end },
        status: { notIn: ['CANCELLED', 'cancelled'] }
      },
      include: { OrderItem: true }
    });

    let totalRevenue = 0;
    let totalDiscount = 0;
    let totalDeliveryFee = 0;
    const paymentMethods = {};
    const bestSellingMap = {};

    for (const order of orders) {
      totalRevenue += Number(order.total || 0);
      totalDiscount += Number(order.discount || 0);
      totalDeliveryFee += Number(order.deliveryFee || 0);

      const pm = order.paymentMethod || 'CASH';
      paymentMethods[pm] = (paymentMethods[pm] || 0) + Number(order.total || 0);

      for (const item of order.OrderItem) {
        if (!bestSellingMap[item.productName]) {
          bestSellingMap[item.productName] = { name: item.productName, quantity: 0, sales: 0 };
        }
        bestSellingMap[item.productName].quantity += item.quantity;
        bestSellingMap[item.productName].sales += Number(item.total || 0);
      }
    }

    res.json({
      period: { start, end },
      summary: {
        totalOrders: orders.length,
        totalRevenue,
        totalDiscount,
        totalDeliveryFee,
        averageOrderValue: orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0
      },
      paymentMethods: Object.entries(paymentMethods).map(([method, amount]) => ({ method, amount })),
      bestSellingProducts: Object.values(bestSellingMap).sort((a, b) => b.quantity - a.quantity).slice(0, 10)
    });
  } catch (e) {
    next(e);
  }
});

router.get('/reports/profit-loss', async (req, res, next) => {
  try {
    const { startDate, endDate, range } = req.query;
    const now = new Date();

    let start = new Date(now.getFullYear(), now.getMonth(), 1);
    let end = new Date(now);
    end.setHours(23, 59, 59, 999);

    if (range === 'today') {
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
    } else if (range === '7days') {
      start = new Date(now);
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
    } else if (range === '30days') {
      start = new Date(now);
      start.setDate(now.getDate() - 29);
      start.setHours(0, 0, 0, 0);
    } else if (startDate && endDate) {
      start = new Date(`${startDate}T00:00:00`);
      end = new Date(`${endDate}T23:59:59.999`);
    }

    const [orders, expenses] = await Promise.all([
      prisma.order.findMany({
        where: {
          tenantId: req.tenant.id,
          createdAt: { gte: start, lte: end },
          status: { notIn: ['CANCELLED', 'cancelled'] }
        },
        include: { OrderItem: true }
      }),
      prisma.expense.findMany({
        where: {
          tenantId: req.tenant.id,
          createdAt: { gte: start, lte: end }
        }
      })
    ]);

    let totalRevenue = 0;
    let costOfGoodsSold = 0;

    for (const order of orders) {
      totalRevenue += Number(order.total || 0);
      for (const item of order.OrderItem) {
        costOfGoodsSold += item.quantity * Number(item.unitCost || 0);
      }
    }

    const grossProfit = totalRevenue - costOfGoodsSold;
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const netProfit = grossProfit - totalExpenses;
    const grossMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : 0;
    const netMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0;

    res.json({
      period: { start, end },
      pnl: {
        totalRevenue,
        costOfGoodsSold,
        grossProfit,
        grossMargin: Number(grossMargin),
        operatingExpenses: totalExpenses,
        netProfit,
        netMargin: Number(netMargin)
      },
      expensesBreakdown: expenses.map(e => ({
        id: e.id,
        title: e.title,
        amount: Number(e.amount),
        createdAt: e.createdAt
      }))
    });
  } catch (e) {
    next(e);
  }
});

// -------------------------------------------------------------
// 10. INVENTORY MANAGEMENT & STOCK MOVEMENTS
// -------------------------------------------------------------
router.get('/inventory', async (req, res, next) => {
  try {
    const [rawProducts, rawMovements] = await Promise.all([
      prisma.product.findMany({
        where: { tenantId: req.tenant.id, isActive: true },
        include: { Category: true, ProductVariant: true },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.inventoryMovement.findMany({
        where: { ProductVariant: { Product: { tenantId: req.tenant.id } } },
        include: {
          ProductVariant: { include: { Product: true } },
          Branch: true
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      })
    ]);

    const products = rawProducts.map(formatProduct);
    const movements = rawMovements.map(m => ({
      id: m.id,
      type: m.type,
      quantity: m.quantity,
      note: m.note,
      createdAt: m.createdAt,
      branch: m.Branch?.name || 'Main Branch',
      productName: m.ProductVariant?.Product?.name || m.ProductVariant?.name || '—',
      sku: m.ProductVariant?.sku || '—'
    }));

    res.json({ products, movements });
  } catch (e) {
    next(e);
  }
});

// Manual Stock Adjustment
router.post('/inventory/adjust', requirePermission('inventory'), async (req, res, next) => {
  try {
    const d = z.object({
      variantId: z.string(),
      type: z.enum(['IN', 'OUT']),
      quantity: z.coerce.number().int().positive('Quantity must be greater than 0'),
      note: z.string().min(1, 'Reason for adjustment is required')
    }).parse(req.body);

    const variant = await prisma.productVariant.findFirst({
      where: {
        id: d.variantId,
        Product: { tenantId: req.tenant.id }
      },
      include: { Product: true }
    });
    if (!variant) return res.status(404).json({ message: 'Product variant not found' });

    if (d.type === 'OUT' && variant.stock < d.quantity) {
      return res.status(400).json({
        message: `Cannot decrease stock below 0. Current stock: ${variant.stock}`
      });
    }

    const updated = await prisma.$transaction(async tx => {
      const v = await tx.productVariant.update({
        where: { id: variant.id },
        data: {
          stock: d.type === 'IN' ? { increment: d.quantity } : { decrement: d.quantity }
        }
      });

      const branch = req.branch || await tx.branch.findFirst({
        where: { tenantId: req.tenant.id, isActive: true }
      });

      if (branch) {
        await tx.branchStock.upsert({
          where: {
            branchId_variantId: {
              branchId: branch.id,
              variantId: variant.id
            }
          },
          update: {
            quantity: d.type === 'IN' ? { increment: d.quantity } : { decrement: d.quantity }
          },
          create: {
            branchId: branch.id,
            variantId: variant.id,
            quantity: v.stock
          }
        });
      }

      await tx.inventoryMovement.create({
        data: {
          variantId: variant.id,
          branchId: branch?.id || null,
          type: d.type,
          quantity: d.quantity,
          note: d.note
        }
      });

      return v;
    });

    res.json({
      message: 'Stock adjusted successfully',
      newStock: updated.stock
    });
  } catch (e) {
    next(e);
  }
});

// -------------------------------------------------------------
// 11. SUBSCRIPTION INFORMATION & UPGRADE REQUEST
// -------------------------------------------------------------
router.get('/subscriptions/plans', async (req, res, next) => {
  try {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' }
    });
    res.json(plans.map(p => ({
      ...p,
      priceMonthly: Number(p.price),
      maxProducts: p.name === 'Business' ? 10000 : p.name === 'Standard' ? 2000 : 500,
      maxStaff: p.name === 'Business' ? 20 : p.name === 'Standard' ? 5 : 2
    })));
  } catch (e) {
    next(e);
  }
});

router.get('/subscriptions/current', async (req, res, next) => {
  try {
    const sub = await prisma.subscription.findFirst({
      where: { tenantId: req.tenant.id },
      orderBy: { createdAt: 'desc' },
      include: { Plan: true }
    });

    if (!sub) return res.json(null);

    const now = new Date();
    const expiresAt = new Date(sub.expiresAt);
    const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

    const { Plan, ...rest } = sub;
    res.json({
      ...rest,
      amountDue: Number(sub.amountDue),
      amountPaid: Number(sub.amountPaid),
      status: (sub.status || 'TRIAL').toUpperCase(),
      daysLeft,
      plan: Plan ? {
        ...Plan,
        priceMonthly: Number(Plan.price)
      } : null
    });
  } catch (e) {
    next(e);
  }
});

// Submit payment slip / Upgrade request (for Super Admin to verify)
router.post('/subscriptions/request', requireOwner, async (req, res, next) => {
  try {
    const d = z.object({
      planId: z.string(),
      paymentMethod: z.string().min(1, 'Payment method is required'),
      paymentSlipUrl: z.string().optional().nullable(),
      notes: z.string().optional()
    }).parse(req.body);

    const plan = await prisma.plan.findUnique({ where: { id: d.planId } });
    if (!plan) return res.status(404).json({ message: 'Selected plan not found' });

    const expDate = new Date();
    expDate.setDate(expDate.getDate() + plan.durationDays);

    const sub = await prisma.subscription.create({
      data: {
        tenantId: req.tenant.id,
        planId: plan.id,
        status: 'pending',
        startsAt: new Date(),
        expiresAt: expDate,
        amountDue: plan.price,
        amountPaid: plan.price,
        paymentMethod: d.paymentMethod,
        paymentSlipUrl: d.paymentSlipUrl || null,
        paymentStatus: 'pending'
      },
      include: { Plan: true }
    });

    res.status(201).json({
      message: 'Subscription upgrade request submitted. Waiting for Platform Admin approval.',
      subscription: {
        ...sub,
        amountDue: Number(sub.amountDue),
        amountPaid: Number(sub.amountPaid)
      }
    });
  } catch (e) {
    next(e);
  }
});

export default router;
