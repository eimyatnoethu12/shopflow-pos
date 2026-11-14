# Business Logic & Workflows

This document details the core business logic, calculations, and transactional workflows implemented in ShopFlow POS.

---

## 1. POS Sales Transaction Lifecycle

```
[Cashier adds items to Cart]
           │
           ▼
[POST /api/orders]
           │
           ├─► 1. Verify Customer exists (if provided)
           ├─► 2. Load Products & ProductVariants for requested IDs
           ├─► 3. Validate stock: variant.stock >= requested quantity
           │      (Throws 400 with item name if insufficient)
           │
           ▼ [Within Prisma Transaction]
           ├─► 4. Calculate Subtotal = sum(unitPrice * quantity)
           ├─► 5. Compute Grand Total = Subtotal - Discount + DeliveryFee
           ├─► 6. Create Order record with OrderItems (snapshot unitPrice & unitCost)
           ├─► 7. Decrement ProductVariant.stock by quantity
           ├─► 8. Decrement BranchStock.quantity by quantity
           └─► 9. Create InventoryMovement record ('OUT', 'POS Sale Order #...')
```

### Why Snapshot `unitCost` in `OrderItem`?
When a product's acquisition cost changes over time, historical profit calculations must remain accurate. By copying `unitCost` at the moment of sale into `OrderItem.unitCost`, historical Cost of Goods Sold (COGS) reports reflect the exact cost at transaction time.

---

## 2. Order Cancellation & Stock Restoration

If an order is cancelled via `PATCH /api/orders/:id/status` with `status: 'CANCELLED'`:
1. The server checks that the order was not already cancelled.
2. Inside a database transaction:
   - For every item in `OrderItem`:
     - Increments `ProductVariant.stock` by the sold quantity.
     - Increments `BranchStock.quantity` at the fulfilling branch.
     - Logs an `InventoryMovement` entry with `type: 'IN'` and note `'Restocked on Cancel Order #...'`.
   - Sets `order.status = 'CANCELLED'`.
   - Sets `order.paymentStatus = 'REFUNDED'`.

A cancelled order can **never** be re-opened to prevent double-restocking bugs.

---

## 3. Financial & Accounting Formulas

### Revenue:
$$\text{Revenue} = \sum (\text{Order.total}) \quad \text{where status} \neq \text{'CANCELLED'}$$

### Cost of Goods Sold (COGS):
$$\text{COGS} = \sum (\text{OrderItem.quantity} \times \text{OrderItem.unitCost})$$

### Gross Profit:
$$\text{Gross Profit} = \text{Revenue} - \text{COGS}$$
$$\text{Gross Margin \%} = \left(\frac{\text{Gross Profit}}{\text{Revenue}}\right) \times 100$$

### Operating Expenses:
$$\text{Operating Expenses} = \sum (\text{Expense.amount}) \quad \text{within date range}$$

### Net Profit:
$$\text{Net Profit} = \text{Gross Profit} - \text{Operating Expenses}$$
$$\text{Net Margin \%} = \left(\frac{\text{Net Profit}}{\text{Revenue}}\right) \times 100$$

*Note: ShopFlow POS strictly isolates Gross Profit (sales margin) from Net Profit (after rent, electricity, packaging, and operating costs) to avoid misleading business owners.*

---

## 4. Subscription & Payment Approval Workflow

```
[Shop Owner requests upgrade/renewal in /subscription]
           │
           ├─► Selects Plan (Starter / Standard / Business)
           ├─► Selects Payment Method (KBZPay / WavePay)
           └─► Submits Transaction Reference / Slip URL
           │
           ▼
[POST /api/subscriptions/request]
Creates Subscription record:
- status: 'pending'
- paymentStatus: 'pending'
- amountDue: Plan.price
           │
           ▼
[Super Admin inspects Slip in /admin/subscriptions]
           │
   ┌───────┴────────────────────────┐
   ▼                                ▼
[Approve Payment]           [Reject Payment]
   │                                │
   ├─► paymentStatus: 'paid'        └─► paymentStatus: 'rejected'
   ├─► amountPaid: amountDue            status: 'pending'
   ├─► status: 'active'
   ├─► startsAt: now
   ├─► expiresAt: now + plan.durationDays
   └─► Tenant.status: 'active'
```

---

## 5. Duplicate SKU Validation

To prevent catalog corruption and scanning errors in the POS terminal:
- In `server/src/routes/shop.js`, creating or updating a product validates:
  ```js
  const existingSku = await prisma.product.findFirst({
    where: {
      tenantId: req.tenant.id,
      sku: baseSku
    }
  });
  ```
- If a match is found in the same tenant, a `409 Conflict` error is returned with a friendly message:
  `"Product SKU '...' is already in use in your shop. Please use a unique SKU."`
- The system also permits auto-generating a unique SKU if the user leaves the SKU field blank.

---

## 6. User CRUD & Password Management Architecture

### A. Password Security Standard
- All passwords are encrypted using `bcryptjs` with cost factor 12 (`bcrypt.hash(password, 12)`).
- Raw passwords and password hashes are **never returned** in JSON responses.
- Minimum password length is enforced at 6 characters across all registration, creation, and reset endpoints.

### B. Two-Tier Administrative Control
1. **Super Admin (Platform Owner)**:
   - Full global user directory at `/admin/users`.
   - Can create new platform users (`POST /api/admin/users`).
   - Can update user profile, email, or toggle `isPlatformAdmin` (`PATCH /api/admin/users/:id`).
   - Can instantly reset any user's password (`POST /api/admin/users/:id/reset-password`).
   - Can delete accounts (`DELETE /api/admin/users/:id`), with self-deletion protection to prevent platform lockout.
2. **Shop Owner / Admin (Tenant Owner)**:
   - Scoped staff management at `/staff`.
   - When adding a staff member (`POST /api/staff`), an initial password is provided and securely hashed.
   - If an account already exists for that email, the shop owner can provision access and set their password.
   - Dedicated password reset (`POST /api/staff/:id/reset-password`) allows shop owners to unlock staff accounts or reset forgotten credentials immediately.
   - Full staff editing (`PATCH /api/staff/:id`) allows updating staff name, branch, role, permissions, and optional password reset.
3. **Self-Service Password Change**:
   - Authenticated users can change their own password at `POST /api/auth/change-password` by providing both `currentPassword` and `newPassword`.
