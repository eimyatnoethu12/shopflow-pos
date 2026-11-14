# System Architecture & Security

This document outlines the architectural patterns, security model, and tenant isolation design in ShopFlow POS.

---

## 1. Architectural Philosophy

ShopFlow POS follows a clean, decoupled client-server architecture:
- **Client Tier**: Single-Page Application (SPA) built with React 18, Vite, and React Router v6.
- **API Tier**: RESTful API built on Express (Node.js ES Modules) with Zod schema validation.
- **Persistence Tier**: Relational PostgreSQL database managed with Prisma ORM.

```
                    ┌─────────────────────────┐
                    │  React + Vite Frontend  │
                    │  (Port 5173)            │
                    └───────────┬─────────────┘
                                │ JSON / JWT
                                ▼
                    ┌─────────────────────────┐
                    │   Express REST API      │
                    │   (Port 4000)           │
                    │                         │
                    │  ├── /api/auth          │
                    │  ├── /api/admin  ───────┼── Protected by requireSuperAdmin
                    │  └── /api/*      ───────┼── Protected by requireAuth
                    └───────────┬─────────────┘
                                │ Prisma ORM
                                ▼
                    ┌─────────────────────────┐
                    │   PostgreSQL Database   │
                    │   (shopflow on 5432)    │
                    └─────────────────────────┘
```

---

## 2. Multi-Tenant Architecture & Data Isolation

### Shared Database, Pooled Schema
ShopFlow POS implements a **pooled multi-tenant database model**:
- All tenant shops share a single PostgreSQL database (`shopflow`).
- Every business table (`Product`, `Category`, `Order`, `Customer`, `Expense`, `Branch`, `Subscription`) contains a mandatory foreign key `tenantId` linked to the `Tenant` table (`onDelete: Cascade`).

### Strict Server-Side Tenant Scoping
Tenant isolation is enforced strictly on the server in `server/src/middleware/auth.js` and in each route:
1. When a shop user logs in, their JWT payload contains `{ userId, tenantId }`.
2. On every incoming request to `/api/*`, the `requireAuth` middleware verifies:
   - That the user is a valid member of the requested tenant in `TenantUser`.
   - That the `Tenant.status === 'active'`. If a tenant is marked `'suspended'`, access is denied immediately with HTTP `403` (`SHOP_SUSPENDED`).
   - That the shop's active or trial subscription is valid and has not expired.
3. In `server/src/routes/shop.js`, **every database query and transaction filters by `tenantId: req.tenant.id`**:
   - `prisma.product.findMany({ where: { tenantId: req.tenant.id, ... } })`
   - `prisma.order.findMany({ where: { tenantId: req.tenant.id, ... } })`
   - `prisma.customer.findMany({ where: { tenantId: req.tenant.id, ... } })`
4. The client **never** specifies `tenantId` in the body to grant access; `req.tenant.id` is derived strictly from the authenticated session context.

---

## 3. Dual Admin Panel Implementation

ShopFlow POS enforces a clean separation of roles between the Platform Owner and Shop Owners:

### A. Super Admin Panel (`/admin/*`)
- **Target User**: SaaS Platform Owner.
- **Authentication Check**: `user.isPlatformAdmin === true`.
- **Middleware**: `requireSuperAdmin` in `server/src/middleware/auth.js`.
- **Capabilities**:
  - Global overview of all shops across the SaaS platform.
  - Shop activation and suspension (`active` / `suspended`).
  - Plan pricing, duration, and tier management (`Plan` model).
  - Inspection of bank transfer payment slips and one-click subscription approval.
  - Platform-wide revenue totals and user management.

### B. Shop Admin Panel (`/*`)
- **Target User**: Shop Owners, Managers, and Cashiers.
- **Authentication Check**: Active membership in `TenantUser` with non-expired subscription.
- **Middleware**: `requireAuth` + `requirePermission(permissionName)`.
- **Capabilities**:
  - POS Register terminal for quick cashier sales.
  - Product catalog, category management, duplicate SKU validation.
  - Multi-branch stock allocation.
  - Financial reports (Sales Reports, Profit & Loss Statements).
  - Operating expense tracking.
  - Staff management and granular role-based permissions.

---

## 4. Role-Based Access Control (RBAC) & Staff Permissions

Inside each shop tenant, access is managed through the `TenantUser` join table:
- **`role`**:
  - `owner`: Full control over the shop, including staff and billing.
  - `manager`: Operational management (inventory, reports, staff viewing).
  - `cashier`: Focused on POS register and order lookup.
- **`permissions` (JSON Column)**:
  ```json
  {
    "pos": true,
    "inventory": false,
    "orders": true,
    "customers": false,
    "reports": false,
    "manageStaff": false
  }
  ```
  The helper `requirePermission(permissionName)` checks whether `req.user.isPlatformAdmin || req.role === 'owner' || req.permissions[permissionName] === true`.

---

## 5. Security Best Practices
- **Password Hashing**: Bcrypt with 12 salt rounds via `bcryptjs`.
- **HTTP Security Headers**: `helmet` enabled on Express app.
- **CORS Configuration**: Restricts origin to configured `CLIENT_ORIGIN` (defaults to `http://localhost:5173`).
- **Input Validation**: Every incoming payload is parsed and strictly typed using `zod` schemas.
- **Database Transactions**: Multi-step business processes (e.g. POS sale deducting stock and logging inventory movements) are wrapped in `prisma.$transaction` for ACID compliance.
