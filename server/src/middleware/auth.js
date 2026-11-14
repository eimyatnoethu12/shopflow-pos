import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const token = authHeader.slice(7);
    let payload;
    try {
      if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured');
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'Invalid or expired session' });
    }

    if (!payload.userId) {
      return res.status(401).json({ message: 'Invalid session data' });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        TenantUser: {
          include: {
            Tenant: true,
            Branch: true
          }
        }
      }
    });

    if (!user) {
      return res.status(401).json({ message: 'User account not found' });
    }

    // Determine target tenant ID:
    // Can come from header 'x-tenant-id' (useful for Super Admin switching), or from JWT payload
    const requestedTenantId = req.headers['x-tenant-id'] || payload.tenantId;

    // Platform Super Admin bypass / elevation:
    if (user.isPlatformAdmin) {
      req.user = user;
      req.isPlatformAdmin = true;

      // If a tenant was requested or user has a tenant
      const activeMembership = user.TenantUser.find(m => requestedTenantId ? m.tenantId === requestedTenantId : m.Tenant.status === 'active') || user.TenantUser[0];
      if (activeMembership) {
        req.tenant = activeMembership.Tenant;
        req.membership = activeMembership;
        req.branch = activeMembership.Branch;
        req.role = 'owner';
        req.permissions = { pos: true, inventory: true, orders: true, customers: true, reports: true, manageStaff: true };
      } else if (requestedTenantId) {
        const targetTenant = await prisma.tenant.findUnique({
          where: { id: requestedTenantId },
          include: { Branch: true }
        });
        if (targetTenant) {
          req.tenant = targetTenant;
          req.branch = targetTenant.Branch?.[0] || null;
          req.role = 'owner';
          req.permissions = { pos: true, inventory: true, orders: true, customers: true, reports: true, manageStaff: true };
        }
      }
      return next();
    }

    // Standard Tenant User validation:
    if (!requestedTenantId) {
      return res.status(400).json({ message: 'No active shop selected' });
    }

    const membership = user.TenantUser.find(m => m.tenantId === requestedTenantId);
    if (!membership) {
      return res.status(403).json({ message: 'You do not have access to this shop' });
    }

    if (membership.Tenant.status !== 'active') {
      return res.status(403).json({
        message: 'This shop account has been suspended or is inactive. Please contact support.',
        code: 'SHOP_SUSPENDED'
      });
    }

    // Check Tenant Subscription
    const subscription = await prisma.subscription.findFirst({
      where: { tenantId: membership.tenantId },
      orderBy: { createdAt: 'desc' },
      include: { Plan: true }
    });

    const now = new Date();
    const isExpired = !subscription ||
      !['active', 'trial'].includes(subscription.status) ||
      new Date(subscription.expiresAt) <= now;

    if (isExpired) {
      return res.status(403).json({
        message: 'Shop subscription has expired or is inactive. Please renew your plan.',
        code: 'SUBSCRIPTION_REQUIRED',
        subscription
      });
    }

    req.user = user;
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

// Super Admin platform owner only
export async function requireSuperAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const token = authHeader.slice(7);
    let payload;
    try {
      if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured');
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'Invalid or expired session' });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId }
    });

    if (!user || !user.isPlatformAdmin) {
      return res.status(403).json({
        message: 'Platform Super Admin access required. Permission denied.'
      });
    }

    req.user = user;
    req.isPlatformAdmin = true;
    next();
  } catch (error) {
    next(error);
  }
}

// Owner / Manager access
export function requireOwner(req, res, next) {
  if (req.user?.isPlatformAdmin || ['owner', 'manager'].includes(req.role)) {
    return next();
  }
  return res.status(403).json({ message: 'Owner or Manager permission required' });
}

// Permission-based access
export function requirePermission(permission) {
  return (req, res, next) => {
    if (
      req.user?.isPlatformAdmin ||
      req.role === 'owner' ||
      req.permissions?.[permission] === true
    ) {
      return next();
    }
    return res.status(403).json({
      message: `Permission denied: Requires '${permission}' access`
    });
  };
}
