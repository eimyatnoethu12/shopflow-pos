# REST API Reference Documentation

All authenticated endpoints require an `Authorization: Bearer <JWT_TOKEN>` HTTP header.
Endpoints under `/api/*` are scoped to the authenticated tenant (or can receive an optional `x-tenant-id` header for Super Admin testing).

---

## 1. Authentication APIs (`/api/auth`)

### `POST /api/auth/register`
Registers a new shop owner user, creates the shop tenant, creates the main branch, grants `owner` role, and sets up a 14-day trial subscription on the Starter plan.
- **Request Body**:
  ```json
  {
    "name": "Daw Khin Myint",
    "shopName": "Khin Online Shop",
    "email": "khin@shop.com",
    "password": "Password123!",
    "phone": "09 799 123 456"
  }
  ```
- **Response `201 Created`**: Returns `{ token, user, tenant, branch, role, permissions, subscription }`.

### `POST /api/auth/login`
Authenticates a shop owner, staff member, or platform Super Admin.
- **Request Body**:
  ```json
  {
    "email": "owner@demo.shop",
    "password": "ShopFlow123!"
  }
  ```
- **Response `200 OK`**: Returns `{ token, user, tenant, branch, role, permissions, subscription, availableTenants }`.

### `GET /api/auth/me`
Retrieves the current authenticated session profile and associated tenant data.
- **Response `200 OK`**: Profile details, subscription status, and accessible shops.

### `POST /api/auth/change-password`
Allows any logged-in user to change their own password securely.
- **Request Body**:
  ```json
  {
    "currentPassword": "OldPassword123!",
    "newPassword": "NewPassword123!"
  }
  ```
- **Response `200 OK`**: `{ "message": "Password changed successfully" }`

### `POST /api/auth/switch-tenant`
Switches the active shop tenant context for accounts that belong to multiple shops or for Super Admins.
- **Request Body**: `{ "tenantId": "cuid_string" }`
- **Response `200 OK`**: `{ token, tenant, branch, role, subscription }`.

---

## 2. Super Admin APIs (`/api/admin`)
*Protected by `requireSuperAdmin` middleware (`user.isPlatformAdmin === true`).*

### `GET /api/admin/overview`
Returns global platform metrics:
- Total registered shops, active shops, suspended shops.
- Total users, total platform orders, total revenue collected from subscriptions.
- Pending payment slips count.
- Recent registered shops and recent payment requests.

### `GET /api/admin/tenants`
Lists all shops across the SaaS platform.
- **Query Parameters**:
  - `search` (optional): Case-insensitive search on name, slug, phone.
  - `status` (optional): `'all'`, `'active'`, `'suspended'`.
- **Response**: Array of shops with owner contact, branch count, product count, order count, and subscription info.

### `GET /api/admin/tenants/:id`
Retrieves detailed breakdown for an individual shop (owner, staff list, branches, subscription history, and metrics).

### `PATCH /api/admin/tenants/:id/status`
Activates or suspends a shop account.
- **Request Body**: `{ "status": "active" | "suspended" }`

### `GET /api/admin/plans`
Lists all subscription tiers with price, duration, and subscriber counts.

### `POST /api/admin/plans`
Creates a new subscription plan tier.
- **Request Body**:
  ```json
  {
    "name": "Enterprise",
    "price": 100000,
    "durationDays": 30,
    "isActive": true
  }
  ```

### `PATCH /api/admin/plans/:id`
Updates plan pricing, duration, or active status.

### `GET /api/admin/subscriptions`
Lists all tenant subscription requests across the platform.
- **Query Parameters**:
  - `paymentStatus` (optional): `'all'`, `'pending'`, `'paid'`, `'rejected'`.
  - `status` (optional): `'active'`, `'trial'`, `'expired'`, `'pending'`.

### `POST /api/admin/subscriptions/:id/approve`
Approves a pending payment slip and automatically activates the tenant's subscription.
- Extends or resets `expiresAt` based on plan's `durationDays`.
- Sets `paymentStatus: 'paid'`, `amountPaid = amountDue`, `status: 'active'`.
- Ensures tenant account is set to `'active'`.

### `POST /api/admin/subscriptions/:id/reject`
Rejects a payment request: sets `paymentStatus: 'rejected'`.

### `PATCH /api/admin/subscriptions/:id`
Manually edits a subscription's expiry date, status, or paid amount.
- **Request Body**: `{ "status": "active", "expiresAt": "2026-12-31" }`

### `GET /api/admin/users`
Lists all platform users, their roles, and associated shops.

### `POST /api/admin/users`
Creates a new platform user directly as Super Admin.
- **Request Body**:
  ```json
  {
    "name": "Staff Name",
    "email": "staff@example.com",
    "password": "Password123!",
    "isPlatformAdmin": false
  }
  ```
- **Response `201 Created`**: Returns `{ id, name, email, isPlatformAdmin, createdAt }`.

### `PATCH /api/admin/users/:id`
Updates user profile, email, optional password reset, or toggles `isPlatformAdmin: true | false`.
- **Request Body**:
  ```json
  {
    "name": "Updated Name",
    "email": "updated@example.com",
    "password": "OptionalNewPassword123!",
    "isPlatformAdmin": false
  }
  ```

### `POST /api/admin/users/:id/reset-password`
Directly resets any user's password to a new value (hashed with bcrypt).
- **Request Body**: `{ "password": "NewSecretPassword123!" }`
- **Response `200 OK`**: `{ "message": "Password for ... has been reset successfully" }`

### `DELETE /api/admin/users/:id`
Deletes a user account. Prevents deleting the logged-in Super Admin's own account.
- **Response `200 OK`**: `{ "message": "User account deleted successfully" }`

---

## 3. Shop Admin & POS APIs (`/api`)
*Protected by `requireAuth` + tenant isolation.*

### `GET /api/dashboard`
Returns live metrics for the authenticated shop:
- `todaySales`, `monthSales`, `totalOrders`, `totalProducts`, `totalCustomers`, `totalStock`, `lowStock`.
- `monthCOGS`, `monthGrossProfit`, `totalExpenses`, `netProfit`.
- `chartData`: 7-day daily sales timeline array.
- `lowStockProducts`: Items at or below restock threshold.
- `topProducts`: Ranked best-sellers by units sold.
- `recentOrders`: Latest 5 orders with status.

### Products (`/api/products`)
- `GET /api/products`: Lists products. Supports `?search=` and `?categoryId=`.
- `POST /api/products`: Creates product.
  - **Body**:
    ```json
    {
      "name": "Royal Myanmar Teamix",
      "sku": "RMT-30S",
      "categoryId": "category_cuid",
      "description": "Authentic tea",
      "costPrice": 4200,
      "sellingPrice": 5800,
      "stock": 50
    }
    ```
  - **Validation**: Enforces unique `sku` within the tenant.
- `PATCH /api/products/:id`: Updates product name, SKU, price, cost, or stock.
- `DELETE /api/products/:id`: Archives product (`isActive: false`).

### Categories (`/api/categories`)
- `GET /api/categories`: Lists categories with product counts.
- `POST /api/categories`: `{ "name": "Beverages" }`.
- `DELETE /api/categories/:id`: Deletes category.

### POS & Orders (`/api/orders`)
- `GET /api/orders`: Lists orders. Supports `?status=`, `?search=`.
- `POST /api/orders`: POS Sale Checkout.
  - **Body**:
    ```json
    {
      "customerId": "cust_id_or_null",
      "discount": 500,
      "deliveryFee": 1000,
      "paymentMethod": "KBZPay",
      "items": [
        { "productId": "prod_id", "quantity": 2 }
      ]
    }
    ```
  - **Business Logic**: Validates stock availability, decrements stock in `ProductVariant` and `BranchStock`, records `InventoryMovement` ('OUT'), and creates order with `paymentStatus: 'PAID'`.
- `PATCH /api/orders/:id/status`:
  - **Body**: `{ "status": "CANCELLED" }`.
  - **Business Logic**: If set to `'CANCELLED'`, automatically restores stock quantities and logs `InventoryMovement` ('IN', 'Restocked on Cancel').

### Customers (`/api/customers`)
- `GET /api/customers`: Lists customers with order counts and total spent.
- `POST /api/customers`: `{ "name": "...", "phone": "...", "address": "..." }`.
- `PATCH /api/customers/:id`: Updates customer details.

### Operating Expenses (`/api/expenses`)
- `GET /api/expenses`: Lists expense records.
- `POST /api/expenses`:
  - **Body**: `{ "title": "Store Rent", "amount": 250000, "description": "Monthly rent" }`.
- `DELETE /api/expenses/:id`: Deletes an expense record.

### Financial Reports (`/api/reports`)
- `GET /api/reports/sales`:
  - Query: `?range=today | 7days | 30days | thisMonth | custom&startDate=...&endDate=...`.
  - Returns `totalRevenue`, `totalDiscount`, `totalDeliveryFee`, `averageOrderValue`, `paymentMethods` breakdown, and `bestSellingProducts`.
- `GET /api/reports/profit-loss`:
  - Calculates `totalRevenue`, `costOfGoodsSold` (COGS), `grossProfit`, `grossMargin%`, `operatingExpenses`, `netProfit`, and `netMargin%`.

### Warehouse Inventory (`/api/inventory`)
- `GET /api/inventory`: Lists products with stock status and recent movement logs.
- `POST /api/inventory/adjust`:
  - **Body**: `{ "variantId": "...", "type": "IN" | "OUT", "quantity": 10, "note": "Supplier restock" }`.
  - Updates inventory quantities and records audit log.

### Branches (`/api/branches`)
- `GET /api/branches`: Lists branches with orders and staff counts.
- `POST /api/branches`: `{ "name": "...", "address": "...", "phone": "...", "isMain": false }`.

### Staff (`/api/staff`)
- `GET /api/staff`: Lists staff members and permissions within the current shop.
- `POST /api/staff`: Creates a new staff user or links an existing user, hashes their initial password with bcrypt, and assigns role, branch, and permissions JSON.
  - **Body**:
    ```json
    {
      "name": "Ma Hla",
      "email": "mahla@demo.shop",
      "password": "InitialPassword123!",
      "role": "cashier",
      "branchId": "branch_id",
      "permissions": {
        "pos": true,
        "inventory": false,
        "orders": true,
        "customers": false,
        "reports": false,
        "manageStaff": false
      }
    }
    ```
- `PATCH /api/staff/:id`: Updates staff name, email, role, branch, permissions, and optionally sets a new password (automatically hashed).
- `POST /api/staff/:id/reset-password`: Shop owner directly resets a staff member's password.
  - **Body**: `{ "password": "NewStaffPassword123!" }`
  - **Response `200 OK`**: `{ "message": "Password for ... reset successfully" }`
- `DELETE /api/staff/:id`: Removes staff membership from shop.

### Subscriptions (`/api/subscriptions`)
- `GET /api/subscriptions/plans`: Lists active SaaS plans.
- `GET /api/subscriptions/current`: Retrieves current shop plan, expiry date, days left.
- `POST /api/subscriptions/request`: Submits renewal/upgrade request with payment slip URL for Super Admin verification.
