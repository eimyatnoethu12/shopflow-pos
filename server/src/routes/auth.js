import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  shopName: z.string().min(2, 'Shop name must be at least 2 characters'),
  email: z.string().email('Invalid email address').transform(v => v.toLowerCase().trim()),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address').transform(v => v.toLowerCase().trim()),
  password: z.string().min(1, 'Password is required')
});

const slugify = s =>
  s.toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'shop';

export function issueToken(userId, tenantId = null, isPlatformAdmin = false) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }

  return jwt.sign(
    { userId, tenantId, isPlatformAdmin },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Check shop subscription status
async function checkSubscription(tenantId) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId }
  });

  if (!tenant || tenant.status !== 'active') {
    return {
      allowed: false,
      message: 'This shop is inactive or suspended',
      code: 'SHOP_SUSPENDED'
    };
  }

  const subscription = await prisma.subscription.findFirst({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    include: { Plan: true }
  });

  if (!subscription) {
    return {
      allowed: false,
      message: 'No active subscription plan found',
      code: 'SUBSCRIPTION_REQUIRED'
    };
  }

  const now = new Date();
  if (new Date(subscription.expiresAt) <= now) {
    return {
      allowed: false,
      message: 'Your subscription has expired. Please renew your plan.',
      code: 'SUBSCRIPTION_EXPIRED',
      subscription
    };
  }

  if (!['active', 'trial'].includes(subscription.status)) {
    return {
      allowed: false,
      message: 'Subscription is pending or inactive',
      code: 'SUBSCRIPTION_PENDING',
      subscription
    };
  }

  return {
    allowed: true,
    subscription
  };
}

// REGISTER (Shop Owner + Tenant)
router.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);

    const exists = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (exists) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const starterPlan = await prisma.plan.findFirst({
      where: { name: 'Starter', isActive: true }
    });

    if (!starterPlan) {
      return res.status(500).json({ message: 'Starter plan configuration is missing' });
    }

    const result = await prisma.$transaction(async tx => {
      const user = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          password: await bcrypt.hash(data.password, 12),
          isPlatformAdmin: false
        }
      });

      const slug = slugify(data.shopName);
      let candidate = slug;
      let i = 1;
      while (await tx.tenant.findUnique({ where: { slug: candidate } })) {
        candidate = `${slug}-${i++}`;
      }

      const tenant = await tx.tenant.create({
        data: {
          name: data.shopName,
          slug: candidate,
          phone: data.phone || null,
          status: 'active'
        }
      });

      const branch = await tx.branch.create({
        data: {
          tenantId: tenant.id,
          name: 'Main Branch',
          isMain: true,
          isActive: true
        }
      });

      const membership = await tx.tenantUser.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          branchId: branch.id,
          role: 'owner',
          permissions: {
            pos: true,
            inventory: true,
            orders: true,
            customers: true,
            reports: true,
            manageStaff: true
          }
        }
      });

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 14);

      const subscription = await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: starterPlan.id,
          status: 'trial',
          expiresAt,
          amountDue: 0,
          amountPaid: 0,
          paymentStatus: 'not_required'
        },
        include: { Plan: true }
      });

      return { user, tenant, branch, membership, subscription };
    });

    res.status(201).json({
      token: issueToken(result.user.id, result.tenant.id, false),
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        isPlatformAdmin: false
      },
      tenant: result.tenant,
      branch: result.branch,
      role: 'owner',
      permissions: result.membership.permissions,
      subscription: result.subscription
    });
  } catch (e) {
    next(e);
  }
});

// LOGIN
router.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: {
        TenantUser: {
          include: {
            Tenant: true,
            Branch: true
          }
        }
      }
    });

    if (!user || !(await bcrypt.compare(data.password, user.password))) {
      return res.status(401).json({ message: 'Email or password is incorrect' });
    }

    const isPlatformAdmin = Boolean(user.isPlatformAdmin);
    const activeMemberships = user.TenantUser.filter(m => m.Tenant.status === 'active');

    if (activeMemberships.length === 0 && !isPlatformAdmin) {
      const suspendedMembership = user.TenantUser.find(m => m.Tenant.status !== 'active');
      if (suspendedMembership) {
        return res.status(403).json({
          message: 'Your shop has been suspended by the platform administrator.',
          code: 'SHOP_SUSPENDED'
        });
      }
      return res.status(403).json({ message: 'No active shop access found for this account' });
    }

    const membership = activeMemberships[0] || user.TenantUser[0] || null;
    const tenant = membership?.Tenant || null;
    let access = { allowed: true, subscription: null };

    if (tenant) {
      access = await checkSubscription(tenant.id);
      if (!access.allowed && !isPlatformAdmin) {
        return res.status(403).json({
          message: access.message,
          code: access.code,
          subscriptionRequired: true,
          subscription: access.subscription
        });
      }
    }

    const token = issueToken(user.id, tenant?.id || null, isPlatformAdmin);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isPlatformAdmin
      },
      tenant,
      branch: membership?.Branch || null,
      role: membership?.role || (isPlatformAdmin ? 'superadmin' : 'staff'),
      permissions: membership?.permissions || (isPlatformAdmin ? { pos: true, inventory: true, orders: true, customers: true, reports: true, manageStaff: true } : {}),
      subscription: access.subscription,
      availableTenants: user.TenantUser.map(m => ({
        id: m.Tenant.id,
        name: m.Tenant.name,
        slug: m.Tenant.slug,
        status: m.Tenant.status,
        role: m.role
      }))
    });
  } catch (e) {
    next(e);
  }
});

// CURRENT AUTH / ME
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = req.user;
    const isPlatformAdmin = Boolean(user.isPlatformAdmin);

    let subscription = req.subscription || null;
    if (req.tenant && !subscription) {
      subscription = await prisma.subscription.findFirst({
        where: { tenantId: req.tenant.id },
        orderBy: { createdAt: 'desc' },
        include: { Plan: true }
      });
    }

    const allMemberships = await prisma.tenantUser.findMany({
      where: { userId: user.id },
      include: { Tenant: true, Branch: true }
    });

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isPlatformAdmin
      },
      tenant: req.tenant || null,
      branch: req.branch || null,
      role: req.role || (isPlatformAdmin ? 'superadmin' : 'staff'),
      permissions: req.permissions || (isPlatformAdmin ? { pos: true, inventory: true, orders: true, customers: true, reports: true, manageStaff: true } : {}),
      subscription,
      availableTenants: allMemberships.map(m => ({
        id: m.Tenant.id,
        name: m.Tenant.name,
        slug: m.Tenant.slug,
        status: m.Tenant.status,
        role: m.role
      }))
    });
  } catch (e) {
    next(e);
  }
});

// SWITCH TENANT (For users with multiple shops or platform admins)
router.post('/switch-tenant', requireAuth, async (req, res, next) => {
  try {
    const { tenantId } = z.object({ tenantId: z.string() }).parse(req.body);

    const isPlatformAdmin = Boolean(req.user.isPlatformAdmin);
    let membership = await prisma.tenantUser.findFirst({
      where: { userId: req.user.id, tenantId },
      include: { Tenant: true, Branch: true }
    });

    if (!membership && !isPlatformAdmin) {
      return res.status(403).json({ message: 'You do not belong to this shop' });
    }

    let tenant = membership?.Tenant;
    if (!tenant && isPlatformAdmin) {
      tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { Branch: true }
      });
      if (!tenant) return res.status(404).json({ message: 'Shop not found' });
    }

    if (tenant.status !== 'active' && !isPlatformAdmin) {
      return res.status(403).json({ message: 'This shop is suspended' });
    }

    const access = await checkSubscription(tenant.id);
    if (!access.allowed && !isPlatformAdmin) {
      return res.status(403).json({
        message: access.message,
        code: access.code,
        subscriptionRequired: true
      });
    }

    const token = issueToken(req.user.id, tenant.id, isPlatformAdmin);

    res.json({
      token,
      tenant,
      branch: membership?.Branch || tenant.Branch?.[0] || null,
      role: membership?.role || (isPlatformAdmin ? 'superadmin' : 'staff'),
      subscription: access.subscription
    });
  } catch (e) {
    next(e);
  }
});

// CHANGE OWN PASSWORD
router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = z.object({
      currentPassword: z.string().min(1, 'Current password is required'),
      newPassword: z.string().min(6, 'New password must be at least 6 characters')
    }).parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    res.json({ message: 'Password changed successfully' });
  } catch (e) {
    next(e);
  }
});

export default router;
