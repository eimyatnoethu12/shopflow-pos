# ShopFlow POS — SaaS Starter

React + Vite frontend, Node.js + Express API, PostgreSQL, Prisma ORM.
Bilingual dashboard (Myanmar / English), multi-tenant foundation.

## Requirements
- Node.js 20+
- PostgreSQL 15+
- npm

## Quick start
1. Create a PostgreSQL database, e.g. `shopflow`.
2. Copy `server/.env.example` to `server/.env` and set `DATABASE_URL` and `JWT_SECRET`.
3. Install and migrate:
   ```bash
   cd server
   npm install
   npx prisma generate
   npx prisma migrate dev --name init
   npm run db:seed
   npm run dev
   ```
4. In another terminal:
   ```bash
   cd client
   npm install
   npm run dev
   ```
5. Open http://localhost:5173

Demo seed login:
- Email: `owner@demo.shop`
- Password: `ShopFlow123!`

The seed script creates a demo tenant and owner. Change all secrets and demo credentials before deployment.

## Project structure
- `client/` React + Vite UI
- `server/` Express API, Prisma schema, auth, tenant middleware, feature routes
- `server/prisma/` schema and seed data

## Included starter modules
Authentication, tenant registration/context, dashboard metrics, products, categories, customers,
orders, inventory movements, reports, plans/subscriptions, admin overview, bilingual UI.

## Important production work before taking real payments
- Configure HTTPS, secure cookies, rate limits, email verification and password reset.
- Add automated tests and audit all tenant-scoped endpoints.
- Integrate a real payment provider or documented manual payment verification flow.
- Configure backups, restore drills, monitoring, logging and error reporting.
- Review local tax, privacy, consumer-protection and data-retention requirements.
- Use a dedicated production secret and disable demo seeding.
- This is a functional starter foundation, not a certified accounting or tax product.

## API overview
All authenticated shop endpoints require `Authorization: Bearer <token>`.
- `POST /api/auth/register` create shop owner + tenant
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/dashboard`
- `GET,POST /api/products`; `PATCH,DELETE /api/products/:id`
- `GET,POST /api/customers`; `PATCH,DELETE /api/customers/:id`
- `GET,POST /api/orders`; `PATCH /api/orders/:id/status`
- `GET /api/inventory`
- `GET /api/reports/summary`
- `GET /api/subscriptions/plans`; `GET /api/subscriptions/current`
- `GET /api/admin/overview` (platform admin only)

All shop records are scoped by the authenticated user's active tenant. Never accept `tenantId` from the browser as authorization.
