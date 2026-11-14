# ShopFlow POS — AI & Developer Knowledge Base

Welcome to the **ShopFlow POS** knowledge base. This directory is crafted specifically for AI agents, developers, and system architects to quickly understand, extend, and operate the ShopFlow POS SaaS platform.

---

## 📌 Project Overview

**ShopFlow POS** is a multi-tenant Point of Sale (POS) Software-as-a-Service (SaaS) platform built for the Myanmar retail market and beyond. It features:
- **Two Distinct Admin Panels**:
  1. **Super Admin Panel (Platform Owner)**: Global platform oversight, tenant/shop lifecycle (activation/suspension), subscription tier management, bank slip payment approval, and global revenue analytics.
  2. **Shop Admin Panel (Shop Owner & Staff)**: Modern retail dashboard, fast POS sales checkout, product catalog with SKU validation, category management, order management, customer directory, warehouse inventory movements, expense tracking, and true Profit & Loss (P&L) accounting.
- **Tech Stack**:
  - **Frontend**: React 18, Vite, React Router v6, Lucide Icons.
  - **Backend**: Node.js (ES Modules), Express, Zod validation, JWT, bcryptjs.
  - **Database & ORM**: PostgreSQL 15+, Prisma ORM 6.
  - **Internationalization (i18n)**: Myanmar (မြန်မာ) and English (EN) bilingual support.
  - **Currency**: Myanmar Kyat (MMK).

---

## 📂 Knowledge Base Index

For in-depth documentation, please refer to the following documents in this directory:

1. [**System Architecture & Security (`system_architecture.md`)**](./system_architecture.md)
   - Multi-tenant architecture and strict tenant isolation.
   - Dual Admin Panel implementation.
   - Authentication, JWT token format, and permission middlewares.

2. [**Database Schema & Relationships (`database_schema.md`)**](./database_schema.md)
   - Detailed model reference for all 15 Prisma models.
   - Foreign keys, unique constraints, and schema synchronizations.
   - Migration history and data protection rules.

3. [**API Reference Documentation (`api_documentation.md`)**](./api_documentation.md)
   - Comprehensive endpoint reference:
     - Authentication (`/api/auth/*`)
     - Super Admin Platform APIs (`/api/admin/*`)
     - Shop Admin & POS APIs (`/api/*`)
   - Request payloads, query parameters, and response structures.

4. [**Business Logic & Workflows (`features_and_business_logic.md`)**](./features_and_business_logic.md)
   - POS transaction lifecycle and inventory stock decrement.
   - Order cancellation and automatic inventory restock.
   - Accounting logic: Revenue vs. COGS vs. Gross Profit vs. Net Profit.
   - Subscription lifecycle, payment slip upload, and Super Admin approval.
   - Granular staff permissions JSON structure.

5. [**Setup, Deployment & Operations (`setup_and_maintenance.md`)**](./setup_and_maintenance.md)
   - Prerequisites (Node.js 20+, Docker / PostgreSQL).
   - Environment variables setup (`.env`).
   - Database migration and seed commands.
   - Default login credentials for Super Admin and Demo Shop.
   - Routine operations and maintenance commands.

---

## 🚀 Quick Reference Commands

### Start Backend API Server:
```bash
cd server
npm run dev
# Listens on http://localhost:4000
```

### Start Frontend Client:
```bash
cd client
npm run dev
# Serves on http://localhost:5173
```

### Seed Database:
```bash
cd server
npm run db:seed
```

### Default Accounts:
- **Platform Super Admin**:
  - Email: `superadmin@shopflow.io`
  - Password: `ShopFlow123!`
  - URL: `http://localhost:5173/admin`
- **Shop Owner (Demo Online Shop)**:
  - Email: `owner@demo.shop`
  - Password: `ShopFlow123!`
  - URL: `http://localhost:5173/`
