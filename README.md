# ShopFlow POS — Multi-Tenant SaaS Starter

Modern bilingual (Myanmar / English) retail Point of Sale (POS) and SaaS management platform built with React, Vite, Node.js, Express, PostgreSQL, and Prisma ORM.

---

## ⚡ Quick Start

### 1. Database Setup
Ensure PostgreSQL is running on port `5432` with a database named `shopflow` (e.g. via Docker):
```bash
docker run -d --name shopflow-postgres --restart unless-stopped -e POSTGRES_USER=postgres -e "POSTGRES_PASSWORD=zoranoe#126" -e POSTGRES_DB=shopflow -p 5432:5432 -v shopflow_pgdata:/var/lib/postgresql postgres:latest
```

### 2. Backend Setup & Run
```bash
cd server
npm install
npx prisma generate
npx prisma migrate dev
npm run db:seed
npm run dev
# Backend running on http://localhost:4000
```

### 3. Frontend Setup & Run
```bash
cd client
npm install
npm run dev
# Frontend running on http://localhost:5173
```

---

## 🔑 Demo Login Credentials

### 1. Super Admin Panel (Platform Owner)
- **Email**: `superadmin@shopflow.io`
- **Password**: `ShopFlow123!`
- **Route**: `http://localhost:5173/admin`

### 2. Shop Admin Panel (Shop Owner)
- **Email**: `owner@demo.shop`
- **Password**: `ShopFlow123!`
- **Route**: `http://localhost:5173/`

---

## 🌟 Key Features

### A. Super Admin Panel (Platform Owner)
- Global SaaS metrics: Total shops, active/suspended shops, platform revenue, total users, pending payment slips.
- Shop management: inspect shop details, activate / suspend shops.
- Subscription Plan tiers (Starter, Standard, Business) pricing and duration management.
- Bank transfer slip inspection, one-click payment approve and reject.
- User management and Super Admin privilege assignment.

### B. Shop Admin Panel (Shop Owner & Staff)
- **Dashboard**: Today's sales, month sales, total orders, catalog count, low stock alerts, 7-day visual sales trend, top selling products, recent orders, and real-time net profit estimation.
- **POS Register**: Rapid cashier sales with product search, category filtering, cart management, discounts, delivery fees, payment methods (CASH, KBZPay, WavePay, etc.), and printable receipts.
- **Product Management**: SKU validation, category assignment, cost price, retail price, stock tracking, and archive/delete.
- **Order Management**: Order lifecycle tracking, status fulfillment, and automatic inventory restocking upon cancellation.
- **Inventory Management**: Real-time stock audit, manual stock adjustments (IN/OUT), and movement history log.
- **Financial Reports**: Sales report and true Profit & Loss (P&L) statements with Gross Profit, COGS, and Net Profit calculations.
- **Operating Expenses**: Utility bills, packaging, and operating cost tracking.
- **Branch Management**: Multi-location branch configuration.
- **Staff Management**: Granular permission toggles (`pos`, `inventory`, `orders`, `customers`, `reports`, `manageStaff`).
- **Subscription & Renewals**: Plan comparison, trial countdown, and payment slip submission.

---

## 📚 In-Depth AI & Developer Documentation

All technical documentation, database schemas, and architectural patterns have been recorded in the [`knowledge/`](./knowledge/) folder:
- [**knowledge/README.md**](./knowledge/README.md)
- [**knowledge/system_architecture.md**](./knowledge/system_architecture.md)
- [**knowledge/database_schema.md**](./knowledge/database_schema.md)
- [**knowledge/api_documentation.md**](./knowledge/api_documentation.md)
- [**knowledge/features_and_business_logic.md**](./knowledge/features_and_business_logic.md)
- [**knowledge/setup_and_maintenance.md**](./knowledge/setup_and_maintenance.md)
