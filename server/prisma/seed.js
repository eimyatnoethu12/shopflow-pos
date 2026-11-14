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

    // 2. Create Platform Super Admin User
    const superAdmin = await tx.user.upsert({
      where: { email: 'superadmin@shopflow.io' },
      update: {
        name: 'Platform Super Admin',
        password: passwordHash,
        isPlatformAdmin: true
      },
      create: {
        name: 'Platform Super Admin',
        email: 'superadmin@shopflow.io',
        password: passwordHash,
        isPlatformAdmin: true
      }
    });

    // 3. Create Demo Shop Owner
    const owner = await tx.user.upsert({
      where: { email: 'owner@demo.shop' },
      update: {
        name: 'Demo Owner',
        password: passwordHash,
        isPlatformAdmin: false
      },
      create: {
        name: 'Demo Owner',
        email: 'owner@demo.shop',
        password: passwordHash,
        isPlatformAdmin: false
      }
    });

    // 4. Create Demo Shop Tenant
    const tenant = await tx.tenant.upsert({
      where: { slug: 'demo-shop' },
      update: {
        name: 'Demo Online Shop',
        status: 'active'
      },
      create: {
        name: 'Demo Online Shop',
        slug: 'demo-shop',
        phone: '09 799 000 111',
        status: 'active'
      }
    });

    // 5. Create Main Branch for Demo Shop
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
          address: 'Kamayut, Yangon',
          phone: '09 799 000 111',
          isMain: true,
          isActive: true
        }
      });
    }

    // 6. Connect Owner to Demo Shop
    await tx.tenantUser.upsert({
      where: {
        tenantId_userId: {
          tenantId: tenant.id,
          userId: owner.id
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
        userId: owner.id,
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

    // 7. Connect Super Admin to Demo Shop (so Super Admin can test both panels)
    await tx.tenantUser.upsert({
      where: {
        tenantId_userId: {
          tenantId: tenant.id,
          userId: superAdmin.id
        }
      },
      update: {
        role: 'owner',
        branchId: branch.id
      },
      create: {
        tenantId: tenant.id,
        userId: superAdmin.id,
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

    // 8. Create Demo Shop 14-day Trial Subscription
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

    // 9. Categories for Demo Shop
    const catNames = ['Beverages', 'Food & Snacks', 'Personal Care', 'Groceries'];
    const savedCategories = {};
    for (const name of catNames) {
      const cat = await tx.category.upsert({
        where: {
          tenantId_name: {
            tenantId: tenant.id,
            name
          }
        },
        update: {},
        create: {
          tenantId: tenant.id,
          name
        }
      });
      savedCategories[name] = cat;
    }

    // 10. Sample Products with variants & stock
    const sampleProducts = [
      {
        name: 'Royal Myanmar Teamix (30 Sachets)',
        sku: 'RMT-30S',
        category: 'Beverages',
        costPrice: 4200,
        sellingPrice: 5800,
        stock: 50,
        description: 'Authentic rich Myanmar tea mix'
      },
      {
        name: 'Premier Coffee 3-in-1 (25 Sachets)',
        sku: 'PRM-COF-25',
        category: 'Beverages',
        costPrice: 3800,
        sellingPrice: 5200,
        stock: 35,
        description: 'Smooth aroma instant coffee'
      },
      {
        name: 'Mama Instant Noodles Shrimp Tom Yum',
        sku: 'MAMA-TOM-01',
        category: 'Food & Snacks',
        costPrice: 2200,
        sellingPrice: 3200,
        stock: 4, // Low stock!
        description: 'Popular Thai spicy instant noodle'
      },
      {
        name: 'Shwe Bo Paw San Rice (5kg)',
        sku: 'RICE-SBPS-5K',
        category: 'Groceries',
        costPrice: 19000,
        sellingPrice: 24500,
        stock: 18,
        description: 'Top grade fragrant Myanmar rice'
      },
      {
        name: 'Sunkist Orange Juice (1L Bottle)',
        sku: 'SUNKIST-ORG-1L',
        category: 'Beverages',
        costPrice: 2900,
        sellingPrice: 4200,
        stock: 3, // Low stock!
        description: '100% natural orange juice'
      }
    ];

    const createdVariants = [];
    for (const sp of sampleProducts) {
      let prod = await tx.product.findFirst({
        where: { tenantId: tenant.id, sku: sp.sku }
      });

      if (!prod) {
        prod = await tx.product.create({
          data: {
            tenantId: tenant.id,
            categoryId: savedCategories[sp.category]?.id || null,
            name: sp.name,
            sku: sp.sku,
            description: sp.description,
            isActive: true
          }
        });

        const variant = await tx.productVariant.create({
          data: {
            productId: prod.id,
            name: 'Standard',
            sku: `${sp.sku}-VAR`,
            costPrice: sp.costPrice,
            sellingPrice: sp.sellingPrice,
            stock: sp.stock
          }
        });

        await tx.branchStock.create({
          data: {
            branchId: branch.id,
            variantId: variant.id,
            quantity: sp.stock
          }
        });

        await tx.inventoryMovement.create({
          data: {
            variantId: variant.id,
            branchId: branch.id,
            type: 'IN',
            quantity: sp.stock,
            note: 'Initial opening stock'
          }
        });

        createdVariants.push({ ...variant, productName: prod.name });
      }
    }

    // 11. Sample Customers
    const sampleCustomers = [
      { name: 'Daw Khin Myint', phone: '09 799 123 456', address: 'Kamayut, Yangon' },
      { name: 'U Kyaw Kyaw', phone: '09 420 987 654', address: 'Chan Aye Thar Zan, Mandalay' },
      { name: 'Ko Aung Thu', phone: '09 250 112 233', address: 'Hledan, Yangon' }
    ];

    const savedCustomers = [];
    for (const sc of sampleCustomers) {
      let cust = await tx.customer.findFirst({
        where: { tenantId: tenant.id, name: sc.name }
      });
      if (!cust) {
        cust = await tx.customer.create({
          data: {
            tenantId: tenant.id,
            name: sc.name,
            phone: sc.phone,
            address: sc.address
          }
        });
      }
      savedCustomers.push(cust);
    }

    // 12. Sample Expenses
    const sampleExpenses = [
      { title: 'Shop Electricity Bill', amount: 45000, description: 'Kamayut branch power bill' },
      { title: 'Packaging Bags & Tape', amount: 15000, description: 'Carton and delivery parcel supplies' },
      { title: 'High-speed Fiber Internet', amount: 25000, description: 'Monthly store wifi' }
    ];

    for (const exp of sampleExpenses) {
      const exists = await tx.expense.findFirst({
        where: { tenantId: tenant.id, title: exp.title }
      });
      if (!exists) {
        await tx.expense.create({
          data: {
            tenantId: tenant.id,
            title: exp.title,
            amount: exp.amount,
            description: exp.description
          }
        });
      }
    }

    // 13. Create a Second Tenant to demonstrate Multi-Tenant & Super Admin features
    const secondTenant = await tx.tenant.upsert({
      where: { slug: 'yangon-fresh-mart' },
      update: {},
      create: {
        name: 'Yangon Fresh Mart',
        slug: 'yangon-fresh-mart',
        phone: '09 450 888 999',
        status: 'active'
      }
    });

    const secondOwner = await tx.user.upsert({
      where: { email: 'mart@yangon.shop' },
      update: {},
      create: {
        name: 'Ko Min Zaw',
        email: 'mart@yangon.shop',
        password: passwordHash,
        isPlatformAdmin: false
      }
    });

    await tx.tenantUser.upsert({
      where: {
        tenantId_userId: {
          tenantId: secondTenant.id,
          userId: secondOwner.id
        }
      },
      update: {},
      create: {
        tenantId: secondTenant.id,
        userId: secondOwner.id,
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

    // Create a pending subscription with payment slip for Yangon Fresh Mart (for Super Admin verification)
    const pendingSub = await tx.subscription.findFirst({
      where: { tenantId: secondTenant.id, paymentStatus: 'pending' }
    });

    if (!pendingSub) {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + 30);

      await tx.subscription.create({
        data: {
          tenantId: secondTenant.id,
          planId: savedPlans.Standard.id,
          status: 'pending',
          expiresAt: expDate,
          amountDue: 30000,
          amountPaid: 30000,
          paymentMethod: 'KBZPay',
          paymentSlipUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600',
          paymentStatus: 'pending'
        }
      });
    }

    console.log('================================================');
    console.log('ShopFlow POS SaaS Seed Completed Successfully!');
    console.log('------------------------------------------------');
    console.log('1. Super Admin Account (Platform Owner):');
    console.log('   Email:    superadmin@shopflow.io');
    console.log('   Password: ShopFlow123!');
    console.log('------------------------------------------------');
    console.log('2. Demo Shop Owner Account:');
    console.log('   Email:    owner@demo.shop');
    console.log('   Password: ShopFlow123!');
    console.log('   Shop:     Demo Online Shop (demo-shop)');
    console.log('------------------------------------------------');
    console.log('3. Second Shop (for Super Admin Approval testing):');
    console.log('   Email:    mart@yangon.shop');
    console.log('   Password: ShopFlow123!');
    console.log('   Shop:     Yangon Fresh Mart (yangon-fresh-mart)');
    console.log('================================================');
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
