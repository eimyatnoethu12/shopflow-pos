
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

const EXCLUDED_STATUSES = [
    'cancelled',
    'canceled',
    'void',
    'refunded'
];

function money(value) {
    return Number(value ?? 0);
}

function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function endOfDay(date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
}

function getDateRange(req) {
    const now = new Date();

    const start = req.query.startDate
        ? new Date(`${req.query.startDate}T00:00:00`)
        : startOfDay(now);

    const end = req.query.endDate
        ? new Date(`${req.query.endDate}T23:59:59.999`)
        : endOfDay(now);

    if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        start > end
    ) {
        return null;
    }

    return { start, end };
}

async function getBranchScope(req) {
    // Staff assigned to a branch cannot view another branch's data.
    if (req.branch?.id) {
        return req.branch.id;
    }

    const requestedBranchId = req.query.branchId;

    if (!requestedBranchId) {
        return null;
    }

    const branch = await prisma.branch.findFirst({
        where: {
            id: String(requestedBranchId),
            tenantId: req.tenant.id,
            isActive: true
        },
        select: { id: true }
    });

    if (!branch) {
        return false;
    }

    return branch.id;
}

function orderWhere(tenantId, start, end, branchId) {
    return {
        tenantId,
        createdAt: {
            gte: start,
            lte: end
        },
        status: {
            notIn: EXCLUDED_STATUSES
        },
        ...(branchId ? { branchId } : {})
    };
}

function calculateOrders(orders) {
    let revenue = 0;
    let costOfGoods = 0;
    let discount = 0;
    let deliveryFees = 0;
    let orderCount = orders.length;
    let itemsSold = 0;

    for (const order of orders) {
        const subtotal = money(order.subtotal);
        const orderDiscount = money(order.discount);

        revenue += Math.max(0, subtotal - orderDiscount);
        discount += orderDiscount;
        deliveryFees += money(order.deliveryFee);

        for (const item of order.OrderItem) {
            itemsSold += item.quantity;
            costOfGoods += item.quantity * money(item.unitCost);
        }
    }

    const grossProfit = revenue - costOfGoods;

    return {
        orderCount,
        itemsSold,
        revenue,
        discount,
        deliveryFees,
        costOfGoods,
        grossProfit
    };
}

// GET /api/dashboard/summary
router.get('/summary', async (req, res, next) => {
    try {
        const range = getDateRange(req);

        if (!range) {
            return res.status(400).json({
                message: 'Invalid date range'
            });
        }

        const branchId = await getBranchScope(req);

        if (branchId === false) {
            return res.status(404).json({
                message: 'Branch not found'
            });
        }

        const where = orderWhere(
            req.tenant.id,
            range.start,
            range.end,
            branchId
        );

        const [orders, expenses] = await Promise.all([
            prisma.order.findMany({
                where,
                include: {
                    OrderItem: {
                        select: {
                            quantity: true,
                            unitCost: true
                        }
                    }
                }
            }),

            prisma.expense.findMany({
                where: {
                    tenantId: req.tenant.id,
                    createdAt: {
                        gte: range.start,
                        lte: range.end
                    }
                },
                select: {
                    amount: true
                }
            })
        ]);

        const totals = calculateOrders(orders);

        const totalExpenses = expenses.reduce(
            (sum, expense) => sum + money(expense.amount),
            0
        );

        const netProfit = totals.grossProfit - totalExpenses;

        res.json({
            period: {
                startDate: range.start,
                endDate: range.end
            },
            summary: {
                ...totals,
                expenses: totalExpenses,
                netProfit
            }
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/dashboard/chart?days=7
router.get('/chart', async (req, res, next) => {
    try {
        const days = Math.min(
            Math.max(Number.parseInt(req.query.days, 10) || 7, 1),
            90
        );

        const end = endOfDay(new Date());
        const start = startOfDay(new Date());

        start.setDate(start.getDate() - (days - 1));

        const branchId = await getBranchScope(req);

        if (branchId === false) {
            return res.status(404).json({
                message: 'Branch not found'
            });
        }

        const orders = await prisma.order.findMany({
            where: orderWhere(
                req.tenant.id,
                start,
                end,
                branchId
            ),
            select: {
                createdAt: true,
                subtotal: true,
                discount: true
            },
            orderBy: {
                createdAt: 'asc'
            }
        });

        const daily = {};

        for (let i = 0; i < days; i++) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);

            const key = [
                date.getFullYear(),
                String(date.getMonth() + 1).padStart(2, '0'),
                String(date.getDate()).padStart(2, '0')
            ].join('-');

            daily[key] = {
                date: key,
                sales: 0,
                orders: 0
            };
        }

        for (const order of orders) {
            const date = new Date(order.createdAt);
            const key = [
                date.getFullYear(),
                String(date.getMonth() + 1).padStart(2, '0'),
                String(date.getDate()).padStart(2, '0')
            ].join('-');

            if (daily[key]) {
                daily[key].sales += Math.max(
                    0,
                    money(order.subtotal) - money(order.discount)
                );
                daily[key].orders += 1;
            }
        }

        res.json({
            days,
            data: Object.values(daily)
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/dashboard/top-products?days=30
router.get('/top-products', async (req, res, next) => {
    try {
        const days = Math.min(
            Math.max(Number.parseInt(req.query.days, 10) || 30, 1),
            365
        );

        const end = endOfDay(new Date());
        const start = startOfDay(new Date());
        start.setDate(start.getDate() - (days - 1));

        const branchId = await getBranchScope(req);

        if (branchId === false) {
            return res.status(404).json({
                message: 'Branch not found'
            });
        }

        const orders = await prisma.order.findMany({
            where: orderWhere(
                req.tenant.id,
                start,
                end,
                branchId
            ),
            include: {
                OrderItem: {
                    include: {
                        ProductVariant: {
                            include: {
                                Product: {
                                    select: {
                                        name: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        const products = {};

        for (const order of orders) {
            for (const item of order.OrderItem) {
                const key = item.variantId;

                if (!products[key]) {
                    products[key] = {
                        variantId: key,
                        productName: item.productName,
                        variantName: item.variantName,
                        quantity: 0,
                        sales: 0
                    };
                }

                products[key].quantity += item.quantity;
                products[key].sales += money(item.total);
            }
        }

        const result = Object.values(products)
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);

        res.json({ data: result });
    } catch (error) {
        next(error);
    }
});

// GET /api/dashboard/low-stock?threshold=5
router.get('/low-stock', async (req, res, next) => {
    try {
        const threshold = Math.min(
            Math.max(Number.parseInt(req.query.threshold, 10) || 5, 0),
            10000
        );

        const branchId = await getBranchScope(req);

        if (branchId === false) {
            return res.status(404).json({
                message: 'Branch not found'
            });
        }

        const variants = await prisma.productVariant.findMany({
            where: {
                Product: {
                    is: {
                        tenantId: req.tenant.id,
                        isActive: true
                    }
                }
            },
            include: {
                Product: {
                    select: {
                        name: true,
                        sku: true
                    }
                },
                BranchStock: {
                    where: branchId ? { branchId } : undefined,
                    select: {
                        quantity: true,
                        branchId: true
                    }
                }
            }
        });

        const result = variants
            .map(variant => {
                const quantity = variant.BranchStock.reduce(
                    (sum, stock) => sum + stock.quantity,
                    0
                );

                return {
                    variantId: variant.id,
                    productName: variant.Product.name,
                    productSku: variant.Product.sku,
                    variantName: variant.name,
                    quantity
                };
            })
            .filter(item => item.quantity <= threshold)
            .sort((a, b) => a.quantity - b.quantity);

        res.json({ data: result });
    } catch (error) {
        next(error);
    }
});

export default router;
