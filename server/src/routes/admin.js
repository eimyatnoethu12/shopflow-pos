import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireSuperAdmin } from '../middleware/auth.js';

const router = Router();

// Protect all admin routes with requireSuperAdmin
router.use(requireSuperAdmin);

// 1. OVERVIEW & METRICS
router.get('/overview', async (req, res, next) => {
  try {
    const [
      totalTenants,
      activeTenants,
      suspendedTenants,
      totalUsers,
      totalOrders,
      subscriptionsPaid,
      pendingSlipsCount,
      recentTenants,
      recentSubscriptions
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { status: 'active' } }),
      prisma.tenant.count({ where: { status: 'suspended' } }),
      prisma.user.count(),
      prisma.order.count(),
      prisma.subscription.aggregate({
        where: { paymentStatus: 'paid' },
        _sum: { amountPaid: true }
      }),
      prisma.subscription.count({
        where: { paymentStatus: 'pending' }
      }),
      prisma.tenant.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          TenantUser: {
            where: { role: 'owner' },
            include: { User: true }
          },
          Subscription: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { Plan: true }
          }
        }
      }),
      prisma.subscription.findMany({
        where: { paymentStatus: 'pending' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          Tenant: true,
          Plan: true
        }
      })
    ]);

    const totalRevenue = Number(subscriptionsPaid._sum.amountPaid || 0);

    res.json({
      metrics: {
        totalTenants,
        activeTenants,
        suspendedTenants,
        totalUsers,
        totalOrders,
        totalRevenue,
        pendingSlipsCount
      },
      recentTenants: recentTenants.map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        phone: t.phone,
        status: t.status,
        createdAt: t.createdAt,
        owner: t.TenantUser[0]?.User ? {
          name: t.TenantUser[0].User.name,
          email: t.TenantUser[0].User.email
        } : null,
        currentPlan: t.Subscription[0]?.Plan?.name || 'No Plan',
        subscriptionStatus: t.Subscription[0]?.status || 'None'
      })),
      recentSubscriptions
    });
  } catch (error) {
    next(error);
  }
});

// 2. TENANTS (SHOPS) MANAGEMENT
router.get('/tenants', async (req, res, next) => {
  try {
    const { search, status } = req.query;

    const where = {};
    if (status && status !== 'all') {
      where.status = status;
    }
    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { slug: { contains: search.trim(), mode: 'insensitive' } },
        { phone: { contains: search.trim(), mode: 'insensitive' } }
      ];
    }

    const tenants = await prisma.tenant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        TenantUser: {
          include: { User: true }
        },
        Branch: true,
        Subscription: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { Plan: true }
        },
        _count: {
          select: {
            Product: true,
            Order: true,
            Customer: true
          }
        }
      }
    });

    const result = tenants.map(t => {
      const ownerUser = t.TenantUser.find(tu => tu.role === 'owner')?.User || t.TenantUser[0]?.User;
      const latestSub = t.Subscription[0] || null;

      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        phone: t.phone,
        status: t.status,
        createdAt: t.createdAt,
        owner: ownerUser ? {
          id: ownerUser.id,
          name: ownerUser.name,
          email: ownerUser.email
        } : null,
        branchesCount: t.Branch.length,
        productsCount: t._count.Product,
        ordersCount: t._count.Order,
        customersCount: t._count.Customer,
        subscription: latestSub ? {
          id: latestSub.id,
          planName: latestSub.Plan?.name || 'Unknown',
          status: latestSub.status,
          paymentStatus: latestSub.paymentStatus,
          expiresAt: latestSub.expiresAt,
          daysLeft: Math.ceil((new Date(latestSub.expiresAt) - new Date()) / (1000 * 60 * 60 * 24))
        } : null
      };
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/tenants/:id', async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      include: {
        TenantUser: {
          include: { User: true, Branch: true }
        },
        Branch: true,
        Subscription: {
          orderBy: { createdAt: 'desc' },
          include: { Plan: true }
        },
        _count: {
          select: {
            Product: true,
            Order: true,
            Customer: true,
            Expense: true
          }
        }
      }
    });

    if (!tenant) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    res.json(tenant);
  } catch (error) {
    next(error);
  }
});

// Update Shop Status (Activate / Suspend)
router.patch('/tenants/:id/status', async (req, res, next) => {
  try {
    const { status } = z.object({
      status: z.enum(['active', 'suspended'])
    }).parse(req.body);

    const updated = await prisma.tenant.update({
      where: { id: req.params.id },
      data: { status }
    });

    res.json({
      message: `Shop status updated to ${status}`,
      tenant: updated
    });
  } catch (error) {
    next(error);
  }
});

// 3. SUBSCRIPTION PLANS MANAGEMENT
router.get('/plans', async (req, res, next) => {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: { price: 'asc' },
      include: {
        _count: {
          select: { Subscription: true }
        }
      }
    });

    res.json(plans.map(p => ({
      ...p,
      price: Number(p.price),
      subscriptionsCount: p._count.Subscription
    })));
  } catch (error) {
    next(error);
  }
});

router.post('/plans', async (req, res, next) => {
  try {
    const data = z.object({
      name: z.string().min(2),
      price: z.coerce.number().min(0),
      durationDays: z.coerce.number().int().min(1).default(30),
      isActive: z.boolean().default(true)
    }).parse(req.body);

    const plan = await prisma.plan.create({
      data: {
        name: data.name,
        price: data.price,
        durationDays: data.durationDays,
        isActive: data.isActive
      }
    });

    res.status(201).json({
      ...plan,
      price: Number(plan.price)
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/plans/:id', async (req, res, next) => {
  try {
    const data = z.object({
      name: z.string().min(2).optional(),
      price: z.coerce.number().min(0).optional(),
      durationDays: z.coerce.number().int().min(1).optional(),
      isActive: z.boolean().optional()
    }).parse(req.body);

    const plan = await prisma.plan.update({
      where: { id: req.params.id },
      data
    });

    res.json({
      ...plan,
      price: Number(plan.price)
    });
  } catch (error) {
    next(error);
  }
});

// 4. SUBSCRIPTIONS & PAYMENT SLIPS MANAGEMENT
router.get('/subscriptions', async (req, res, next) => {
  try {
    const { paymentStatus, status } = req.query;

    const where = {};
    if (paymentStatus && paymentStatus !== 'all') {
      where.paymentStatus = paymentStatus;
    }
    if (status && status !== 'all') {
      where.status = status;
    }

    const subscriptions = await prisma.subscription.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        Tenant: true,
        Plan: true
      }
    });

    res.json(subscriptions.map(s => {
      const { Plan, ...rest } = s;
      return {
        ...rest,
        amountDue: Number(s.amountDue),
        amountPaid: Number(s.amountPaid),
        plan: Plan ? {
          ...Plan,
          price: Number(Plan.price)
        } : null
      };
    }));
  } catch (error) {
    next(error);
  }
});

router.patch('/subscriptions/:id', async (req, res, next) => {
  try {
    const data = z.object({
      status: z.enum(['active', 'trial', 'expired', 'suspended', 'pending']).optional(),
      expiresAt: z.string().datetime().or(z.string()).optional(),
      amountPaid: z.coerce.number().min(0).optional(),
      paymentStatus: z.enum(['pending', 'paid', 'rejected', 'not_required']).optional()
    }).parse(req.body);

    const updateData = { ...data };
    if (data.expiresAt) {
      updateData.expiresAt = new Date(data.expiresAt);
    }

    const updated = await prisma.subscription.update({
      where: { id: req.params.id },
      data: updateData,
      include: { Tenant: true, Plan: true }
    });

    res.json({
      message: 'Subscription updated successfully',
      subscription: {
        ...updated,
        amountDue: Number(updated.amountDue),
        amountPaid: Number(updated.amountPaid)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Approve Payment Slip & Activate Subscription
router.post('/subscriptions/:id/approve', async (req, res, next) => {
  try {
    const sub = await prisma.subscription.findUnique({
      where: { id: req.params.id },
      include: { Plan: true, Tenant: true }
    });

    if (!sub) {
      return res.status(404).json({ message: 'Subscription request not found' });
    }

    const durationDays = sub.Plan?.durationDays || 30;
    const now = new Date();
    const newExpiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    const approved = await prisma.$transaction(async tx => {
      const updatedSub = await tx.subscription.update({
        where: { id: sub.id },
        data: {
          status: 'active',
          paymentStatus: 'paid',
          amountPaid: sub.amountDue,
          startsAt: now,
          expiresAt: newExpiresAt
        },
        include: { Tenant: true, Plan: true }
      });

      // Ensure tenant is active
      await tx.tenant.update({
        where: { id: sub.tenantId },
        data: { status: 'active' }
      });

      return updatedSub;
    });

    res.json({
      message: 'Payment approved and subscription activated successfully',
      subscription: {
        ...approved,
        amountDue: Number(approved.amountDue),
        amountPaid: Number(approved.amountPaid)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Reject Payment Slip
router.post('/subscriptions/:id/reject', async (req, res, next) => {
  try {
    const sub = await prisma.subscription.findUnique({
      where: { id: req.params.id }
    });

    if (!sub) {
      return res.status(404).json({ message: 'Subscription request not found' });
    }

    const rejected = await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        paymentStatus: 'rejected',
        status: 'pending'
      },
      include: { Tenant: true, Plan: true }
    });

    res.json({
      message: 'Payment slip rejected',
      subscription: {
        ...rejected,
        amountDue: Number(rejected.amountDue),
        amountPaid: Number(rejected.amountPaid)
      }
    });
  } catch (error) {
    next(error);
  }
});

// 5. USERS MANAGEMENT
router.get('/users', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        isPlatformAdmin: true,
        createdAt: true,
        TenantUser: {
          include: {
            Tenant: {
              select: { id: true, name: true, slug: true, status: true }
            }
          }
        }
      }
    });

    res.json(users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      isPlatformAdmin: u.isPlatformAdmin,
      createdAt: u.createdAt,
      shops: u.TenantUser.map(tu => ({
        tenantId: tu.Tenant.id,
        name: tu.Tenant.name,
        slug: tu.Tenant.slug,
        status: tu.Tenant.status,
        role: tu.role
      }))
    })));
  } catch (error) {
    next(error);
  }
});

// Create New User (Super Admin)
router.post('/users', async (req, res, next) => {
  try {
    const data = z.object({
      name: z.string().min(2, 'Name must be at least 2 characters'),
      email: z.string().email('Invalid email address').transform(v => v.toLowerCase().trim()),
      password: z.string().min(6, 'Password must be at least 6 characters'),
      isPlatformAdmin: z.boolean().default(false)
    }).parse(req.body);

    const existing = await prisma.user.findUnique({
      where: { email: data.email }
    });
    if (existing) {
      return res.status(409).json({ message: 'A user with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        isPlatformAdmin: data.isPlatformAdmin
      },
      select: {
        id: true,
        name: true,
        email: true,
        isPlatformAdmin: true,
        createdAt: true
      }
    });

    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});

// Update User (Super Admin - edit name, email, password, platform admin)
router.patch('/users/:id', async (req, res, next) => {
  try {
    const data = z.object({
      name: z.string().min(2).optional(),
      email: z.string().email().optional(),
      password: z.string().min(6).optional(),
      isPlatformAdmin: z.boolean().optional()
    }).parse(req.body);

    const userToUpdate = await prisma.user.findUnique({
      where: { id: req.params.id }
    });
    if (!userToUpdate) return res.status(404).json({ message: 'User not found' });

    const updateData = {};
    if (data.name) updateData.name = data.name;
    if (data.email) {
      const email = data.email.toLowerCase().trim();
      if (email !== userToUpdate.email) {
        const dup = await prisma.user.findUnique({ where: { email } });
        if (dup) return res.status(409).json({ message: 'Email is already taken by another user' });
      }
      updateData.email = email;
    }
    if (data.isPlatformAdmin !== undefined) updateData.isPlatformAdmin = data.isPlatformAdmin;
    if (data.password && data.password.trim()) {
      updateData.password = await bcrypt.hash(data.password.trim(), 12);
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        isPlatformAdmin: true,
        createdAt: true
      }
    });

    res.json({
      message: 'User updated successfully',
      user: updated
    });
  } catch (error) {
    next(error);
  }
});

// Reset User Password (Super Admin)
router.post('/users/:id/reset-password', async (req, res, next) => {
  try {
    const { password } = z.object({
      password: z.string().min(6, 'Password must be at least 6 characters')
    }).parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.params.id }
    });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const hashedPassword = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    res.json({
      message: `Password for ${user.name} (${user.email}) has been reset successfully`
    });
  } catch (error) {
    next(error);
  }
});

// Delete User (Super Admin)
router.delete('/users/:id', async (req, res, next) => {
  try {
    if (req.user.id === req.params.id) {
      return res.status(400).json({ message: 'You cannot delete your own Super Admin account' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.params.id }
    });
    if (!user) return res.status(404).json({ message: 'User not found' });

    await prisma.user.delete({ where: { id: user.id } });
    res.json({ message: 'User account deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
