
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2),
  shopName: z.string().min(2),
  email: z.string().email().transform(v => v.toLowerCase().trim()),
  password: z.string().min(8),
  phone: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email().transform(v => v.toLowerCase().trim()),
  password: z.string().min(1)
});

const slugify = s =>
  s.toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'shop';

function issueToken(userId, tenantId) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }

  return jwt.sign(
    { userId, tenantId },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Check shop subscription
async function checkSubscription(tenantId) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId }
  });

  if (!tenant || tenant.status !== 'active') {
    return {
      allowed: false,
      message: 'Shop is inactive or blocked'
    };
  }

  const subscription = await prisma.subscription.findFirst({
    where: { tenantId },
    orderBy: { createdAt: 'desc' }
  });

  if (!subscription) {
    return {
      allowed: false,
      message: 'No subscription found'
    };
  }

  if (new Date(subscription.expiresAt) <= new Date()) {
    return {
      allowed: false,
      message: 'Subscription expired'
    };
  }

  if (!['active', 'trial'].includes(subscription.status)) {
    return {
      allowed: false,
      message: 'Subscription is not active'
    };
  }

  return {
    allowed: true,
    subscription
  };
}

// REGISTER
router.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);

    const exists = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (exists) {
      return res.status(409).json({
        message: 'Email already registered'
      });
    }

    const starterPlan = await prisma.plan.findFirst({
      where: {
        name: 'Starter',
        isActive: true
      }
    });

    if (!starterPlan) {
      return res.status(500).json({
        message: 'Starter plan is not configured'
      });
    }

    const result = await prisma.$transaction(async tx => {
      const user = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          password: await bcrypt.hash(data.password, 12)
        }
      });

      const slug = slugify(data.shopName);
      let candidate = slug;
      let i = 1;

      while (
        await tx.tenant.findUnique({
          where: { slug: candidate }
        })
      ) {
        candidate = `${slug}-${i++}`;
      }

      const tenant = await tx.tenant.create({
        data: {
          name: data.shopName,
          slug: candidate,
          phone: data.phone,
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

      await tx.tenantUser.create({
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

      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: starterPlan.id,
          status: 'trial',
          expiresAt,
          amountDue: 0,
          amountPaid: 0,
          paymentStatus: 'not_required'
        }
      });

      return { user, tenant, branch };
    });

    res.status(201).json({
      token: issueToken(result.user.id, result.tenant.id),
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email
      },
      tenant: result.tenant,
      branch: result.branch,
      role: 'owner'
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
      return res.status(401).json({
        message: 'Email or password is incorrect'
      });
    }

    const memberships = user.TenantUser.filter(
      m => m.Tenant.status === 'active'
    );

    if (memberships.length === 0) {
      return res.status(403).json({
        message: 'No active shop access'
      });
    }

    // For now, automatically select the first active shop.
    const membership = memberships[0];
    const tenant = membership.Tenant;

    const access = await checkSubscription(tenant.id);

    if (!access.allowed) {
      return res.status(403).json({
        message: access.message,
        subscriptionRequired: true
      });
    }

    res.json({
      token: issueToken(user.id, tenant.id),
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      tenant,
      branch: membership.Branch,
      role: membership.role,
      permissions: membership.permissions,
      subscription: access.subscription
    });

  } catch (e) {
    next(e);
  }
});

// CURRENT USER
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const access = await checkSubscription(req.tenant.id);

    if (!access.allowed) {
      return res.status(403).json({
        message: access.message,
        subscriptionRequired: true
      });
    }

    const membership = await prisma.tenantUser.findUnique({
      where: {
        tenantId_userId: {
          tenantId: req.tenant.id,
          userId: req.user.id
        }
      },
      include: {
        Branch: true
      }
    });

    if (!membership) {
      return res.status(403).json({
        message: 'Shop membership not found'
      });
    }

    res.json({
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email
      },
      tenant: req.tenant,
      branch: membership.Branch,
      role: membership.role,
      permissions: membership.permissions,
      subscription: access.subscription
    });

  } catch (e) {
    next(e);
  }
});

export default router;
