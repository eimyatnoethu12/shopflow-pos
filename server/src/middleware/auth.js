
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

export async function requireAuth(req, res, next) {
  try {
    // 1. Get Bearer Token
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        message: 'Authentication required'
      });
    }

    const token = authHeader.slice(7);

    // 2. Verify JWT
    let payload;

    try {
      if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not configured');
      }

      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({
        message: 'Invalid or expired session'
      });
    }

    if (!payload.userId || !payload.tenantId) {
      return res.status(401).json({
        message: 'Invalid session data'
      });
    }

    // 3. Find tenant membership
    const membership = await prisma.tenantUser.findFirst({
      where: {
        userId: payload.userId,
        tenantId: payload.tenantId,
        Tenant: {
          is: {
            status: 'active'
          }
        }
      },
      include: {
        User: true,
        Tenant: true,
        Branch: true
      }
    });

    if (!membership) {
      return res.status(403).json({
        message: 'Shop access unavailable'
      });
    }

    // 4. Check subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        tenantId: membership.tenantId
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        Plan: true
      }
    });

    const now = new Date();

    if (
      !subscription ||
      !['active', 'trial'].includes(subscription.status) ||
      new Date(subscription.startsAt) > now ||
      new Date(subscription.expiresAt) <= now
    ) {
      return res.status(403).json({
        message: 'Subscription expired or inactive',
        code: 'SUBSCRIPTION_REQUIRED'
      });
    }

    // 5. Attach authenticated data to request
    req.user = membership.User;
    req.tenant = membership.Tenant;
    req.membership = membership;
    req.branch = membership.Branch;
    req.role = membership.role;
    req.permissions = membership.permissions;
    req.subscription = subscription;

    next();

  } catch (error) {
    next(error);
  }
}

// Owner / Manager access
export function requireOwner(req, res, next) {
  if (!['owner', 'manager'].includes(req.role)) {
    return res.status(403).json({
      message: 'Permission denied'
    });
  }

  next();
}

// Permission-based access
export function requirePermission(permission) {
  return (req, res, next) => {
    if (
      req.role === 'owner' ||
      req.permissions?.[permission] === true
    ) {
      return next();
    }

    return res.status(403).json({
      message: 'You do not have permission to perform this action'
    });
  };
}
