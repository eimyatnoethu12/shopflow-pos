# Setup, Deployment & Operations Guide

This guide covers environment configuration, database setup, running dev servers, seed credentials, and routine maintenance commands for ShopFlow POS.

---

## 1. Prerequisites

- **Node.js**: v20.x or higher (Current environment: Node v24).
- **npm**: v10.x or higher.
- **PostgreSQL**: v15.x or higher (or Docker Desktop running `postgres:latest`).

---

## 2. Environment Variables Configuration

Create or verify `server/.env`:

```env
DATABASE_URL="postgresql://postgres:zoranoe%23126@localhost:5432/shopflow?schema=public"
JWT_SECRET="shopflow-super-secret-jwt-key-2026"
PORT=4000
CLIENT_ORIGIN="http://localhost:5173"
NODE_ENV="development"
```

*Note on special characters in passwords: Characters like `#` must be URL-encoded as `%23`.*

---

## 3. Database Setup (Docker or Local Postgres)

### If using Docker:
```powershell
docker run -d --name shopflow-postgres `
  --restart unless-stopped `
  -e POSTGRES_USER=postgres `
  -e "POSTGRES_PASSWORD=zoranoe#126" `
  -e POSTGRES_DB=shopflow `
  -p 5432:5432 `
  -v shopflow_pgdata:/var/lib/postgresql `
  postgres:latest
```

### Run Migrations & Generate Prisma Client:
```bash
cd server
npm install
npx prisma generate
npx prisma migrate dev
```

### Populate Seed Data:
```bash
npm run db:seed
```

---

## 4. Starting the Application

### Terminal 1: Backend API (Port 4000)
```bash
cd server
npm run dev
# Starts nodemon watching for code changes
```

### Terminal 2: Frontend Client (Port 5173)
```bash
cd client
npm run dev
# Starts Vite development server
```

Open your browser at: **`http://localhost:5173`**

---

## 5. Default Demo Credentials

### 1. Platform Super Admin (Platform Owner)
- **Role**: Super Admin (Full platform management)
- **Email**: `superadmin@shopflow.io`
- **Password**: `ShopFlow123!`
- **URL**: `http://localhost:5173/admin`

### 2. Shop Owner (Retail Shop Demo)
- **Role**: Shop Owner (`Demo Online Shop`)
- **Email**: `owner@demo.shop`
- **Password**: `ShopFlow123!`
- **Shop**: Demo Online Shop (`demo-shop`)
- **Subscription**: Starter Plan (14-day trial)
- **URL**: `http://localhost:5173/`

### 3. Second Shop (For Super Admin Verification Testing)
- **Role**: Shop Owner (`Yangon Fresh Mart`)
- **Email**: `mart@yangon.shop`
- **Password**: `ShopFlow123!`
- **Shop**: Yangon Fresh Mart (`yangon-fresh-mart`)
- **Status**: Standard Plan pending approval with bank transfer slip attached.

---

## 6. Troubleshooting Common Issues

### Issue 1: Database Connection Refused (`localhost:5432`)
- Ensure PostgreSQL service or Docker container is active:
  ```powershell
  docker ps
  # If container stopped:
  docker start shopflow-postgres
  ```

### Issue 2: Prisma Client Out of Sync
- Whenever schema changes are introduced:
  ```bash
  cd server
  npx prisma generate
  ```

### Issue 3: Duplicate SKU Error on Product Creation
- The system enforces unique SKUs per shop. Either enter a unique code or leave the SKU field blank to allow auto-generation.

### Issue 4: Shop Suspended Error
- If a shop owner receives `Shop account is suspended`, log in to the Super Admin Panel (`superadmin@shopflow.io`), navigate to **All Shops**, and click **Activate**.
