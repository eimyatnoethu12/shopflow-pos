
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('ShopFlow123!', 12);

  await prisma.$transaction(async (tx) => {
    // 1. Create or update Plans
    const plans = [
      { name: 'Starter', price: 15000, durationDays: 30 },
      { name: 'Standard', price: 30000, durationDays: 30 },
      { name: 'Business', price: 50000, durationDays: 30 }
    ];

    const savedPlans = {};

    for (const p of plans) {
      const existing = await tx.plan.findFirst({
        where: { name: p.name }
      });

      savedPlans[p.name] = existing
        ? await tx.plan.update({
          where: { id: existing.id },
          data: {
            price: p.price,
            durationDays: p.durationDays,
            isActive: true
          }
        })
        : await tx.plan.create({
          data: {
            ...p,
            isActive: true
          }
        });
    }

    // 2. Create Demo Owner
    const user = await tx.user.upsert({
      where: { email: 'owner@demo.shop' },
      update: {
        name: 'Demo Owner',
        password: passwordHash
      },
      create: {
        name: 'Demo Owner',
        email: 'owner@demo.shop',
        password: passwordHash
      }
    });

    // 3. Create Demo Shop
    const tenant = await tx.tenant.upsert({
      where: { slug: 'demo-shop' },
      update: {
        name: 'Demo Online Shop',
        status: 'active'
      },
      create: {
        name: 'Demo Online Shop',
        slug: 'demo-shop',
        phone: '09 000 000 000',
        status: 'active'
      }
    });

    // 4. Create Main Branch
    let branch = await tx.branch.findFirst({
      where: {
        tenantId: tenant.id,
        isMain: true
      }
    });

    if (!branch) {
      branch = await tx.branch.create({
        data: {
          tenantId: tenant.id,
          name: 'Main Branch',
          isMain: true,
          isActive: true
        }
      });
    }

    // 5. Connect Owner to Shop
    await tx.tenantUser.upsert({
      where: {
        tenantId_userId: {
          tenantId: tenant.id,
          userId: user.id
        }
      },
      update: {
        role: 'owner',
        branchId: branch.id,
        permissions: {
          pos: true,
          inventory: true,
          orders: true,
          customers: true,
          reports: true,
          manageStaff: true
        }
      },
      create: {
        tenantId: tenant.id,
        userId: user.id,
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

    // 6. Create 14-day Trial Subscription if missing
    const existingSubscription = await tx.subscription.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'desc' }
    });

    if (!existingSubscription) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 14);

      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: savedPlans.Starter.id,
          status: 'trial',
          expiresAt,
          amountDue: 0,
          amountPaid: 0,
          paymentStatus: 'not_required'
        }
      });
    }

    console.log('================================');
    console.log('ShopFlow POS Full SaaS Seed Successful!');
    console.log('Email: owner@demo.shop');
    console.log('Password: ShopFlow123!');
    console.log('Shop: Demo Online Shop');
    console.log('Branch: Main Branch');
    console.log('Subscription: 14-Day Trial');
    console.log('================================');
  });
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
