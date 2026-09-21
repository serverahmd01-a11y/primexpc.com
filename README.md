# PrimeX Technologies — Custom PC E-Commerce Platform

A full-stack e-commerce platform for **custom PC builds and computer components**. Built with **React 19 + TypeScript + Vite** on the frontend and **Node.js + Express 5 + MongoDB** on the backend, with integrated payments (Razorpay), shipping (Shiprocket), transactional email (SMTP), and a complete admin panel.

> **Live:** [https://primexpc.com](https://primexpc.com)

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Database Backup & Restore](#database-backup--restore)
- [Image / Upload Storage](#image--upload-storage)
- [API Overview](#api-overview)
- [Deployment](#deployment)
- [License](#license)

---

## Overview

PrimeX is a complete storefront + admin system for selling custom-built PCs, refurbished machines and PC components across India.

It ships as **one deployable unit**: the Express backend serves the REST API, the uploaded media, **and** the built React storefront, so the whole site runs on a single Node.js process / domain.

Key capabilities include a GST-aware cart & checkout, Razorpay online payments with COD (advance + balance) flow, Shiprocket fulfillment, a "Sell Your PC" buyback lead system, CMS pages, banner management, sitemap generation, and detailed admin analytics.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript 6, Vite 8, Tailwind CSS v4, React Router v7, Axios, lucide-react |
| **Backend** | Node.js, Express 5, Mongoose 8 |
| **Database** | MongoDB (local or MongoDB Atlas) |
| **Auth** | JWT (HS256) + bcrypt password hashing |
| **Payments** | Razorpay (UPI / Cards / Net Banking) + COD advance |
| **Shipping** | Shiprocket |
| **Email** | Nodemailer (SMTP) |
| **File Uploads** | Multer (disk storage, configurable directory) |
| **Security** | Helmet, CORS, express-rate-limit, express-mongo-sanitize, xss-clean, hpp |
| **PDF / Docs** | jsPDF, html2canvas (invoice download) |
| **Analytics** | Google Analytics (gtag) |

---

## Features

### Storefront

- **Home** — animated hero, auto-rotating banner slider (up to 6 images), Hot Deals with countdown, category grid, all products, CTA section
- **Product detail** — image gallery, video, GST-inclusive pricing, add-to-cart, wishlist, related products, reviews
- **Catalog** — category tree, filters (category, price, condition, sort), search
- **Live search** — typeahead in the header with product image, name, category and price
- **Cart** — guest cart (localStorage) with server sync on login, quantity controls, GST breakdown
- **Checkout** — saved addresses, Razorpay online payment or COD (20% advance), downloadable HTML invoice
- **Account** — profile, address book (CRUD), order history, wishlist, password reset
- **Sell Your PC** — buyback lead submission flow (brand → category → model → product) with status tracking
- **CMS pages** — dynamic pages rendered at `/page/:slug` (About, Privacy Policy, etc.)
- **Contact** — enquiry form + WhatsApp click-to-chat
- **SEO** — dynamic `sitemap.xml`, `robots.txt`, Open Graph / Twitter meta

### Admin Panel (`/admin`)

- **Dashboard** — revenue, orders, customers, products stats
- **Products** — full CRUD, up to 3 images + video, specs (key/value), GST rate, condition (New / Refurbished), featured & hot deals with sale price + countdown, stock tracking
- **Categories** — hierarchical tree (unlimited nesting), image, condition assignment
- **Orders** — list + detail, status workflow (pending → shipped → delivered / cancelled / returned), Shiprocket push, AWB tracking, label PDF
- **Missed Orders** — record offline orders manually
- **Customers** — list + detail with order history, role management (`user`, `admin`, `ca`, `shipping`)
- **Invoices** — downloadable invoices
- **GST** — tax rate configuration, product distribution, stock value per rate
- **Settings** — Razorpay, Shiprocket, SMTP, store info, GST rates, social links, footer links, banner uploads
- **CMS Pages** — create/edit/toggle pages
- **Sell Leads** — manage buyback leads, brands, categories, models, products
- **Logs** — server log viewer
- **Stock** — quick stock updates

### User Roles

| Role | Access |
|------|--------|
| `user` | Storefront, own orders, profile |
| `admin` | Everything |
| `ca` | Staff access (limited admin) |
| `shipping` | Order actions (status, tracking, settle) |

> The **first registered user** is automatically promoted to `admin`.

---

## Project Structure

```
primexpc/
├── backend/                    # Express API + serves built frontend
│   ├── src/
│   │   ├── config/             # env, db, email, razorpay, shiprocket
│   │   ├── controllers/        # route handlers
│   │   ├── middleware/         # auth, multer (uploads), security
│   │   ├── models/             # Mongoose schemas
│   │   ├── routes/             # Express routers
│   │   ├── seeds/              # seed data
│   │   ├── scripts/            # make-admin, etc.
│   │   └── server.js           # app entry point
│   ├── scripts/                # backup / restore / verify / build helpers
│   ├── uploads/                # local media (production uses UPLOADS_DIR)
│   ├── dist/                   # built storefront (served in production)
│   ├── .env.example
│   └── package.json
│
├── web-storefront/             # React + Vite storefront & admin UI
│   ├── src/
│   │   ├── components/         # Layout, CartDrawer, Skeleton
│   │   ├── lib/                # api, auth, cart, utils, analytics
│   │   ├── pages/              # storefront + admin pages
│   │   └── main.tsx
│   ├── public/
│   ├── .env.example
│   ├── .env.production         # VITE_API_URL=/api (same-origin build)
│   └── package.json
│
└── README.md
```

---

## Getting Started

### Prerequisites

- **Node.js** 18+ (20 / 22 recommended)
- **MongoDB** (local `mongod` or a MongoDB Atlas connection string)
- **npm**

### 1. Clone

```bash
git clone https://github.com/serverahmd01-a11y/primexpc.com.git
cd primexpc.com
```

### 2. Backend setup

```bash
cd backend
npm install
cp .env.example .env      # Windows: copy .env.example .env
# edit .env with your DB_URL, JWT_SECRET, etc.
npm run dev               # starts API on http://localhost:3000
```

### 3. Frontend setup

```bash
cd ../web-storefront
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm run dev               # starts Vite dev server (http://localhost:5173)
```

Open **http://localhost:5173**. Register the first account — it becomes the admin.

### 4. Production-style single-process run (optional)

Build the storefront into the backend, then run the backend only:

```bash
cd backend
npm run build:web         # builds web-storefront and copies dist -> backend/dist
npm start                 # serves API + storefront on http://localhost:3000
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|:--------:|-------------|
| `NODE_ENV` | ✅ | `development` or `production` |
| `PORT` | ✅ | Server port (default `3000`) |
| `DB_URL` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ (prod) | Long random secret for signing tokens |
| `CLIENT_URL` | ✅ | Public site URL (CORS, sitemap, links) |
| `UPLOADS_DIR` | ➖ | Absolute path for media. Defaults to `./uploads`. Set on servers to a persistent path. |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | ➖ | Optional — also configurable in admin Settings |
| `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` | ➖ | Optional — make the first signup with these credentials an admin |

### Frontend (`web-storefront/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | API base URL, e.g. `http://localhost:3000/api` (dev) or `/api` (same-origin prod) |
| `VITE_GA_MEASUREMENT_ID` | Google Analytics measurement ID (optional) |

---

## Available Scripts

### Backend (`cd backend`)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start API with watch mode |
| `npm start` | Start API (production) |
| `npm run build:web` | Build storefront and copy into `backend/dist` |
| `npm run seed:products` | Seed default products |
| `npm run migrate:categories` | Run category migration |
| `npm run make-admin` | Promote a user to admin |
| `npm run backup:db` | JSON backup of all collections |
| `npm run backup:full` | Full backup **with manifest + verification** |
| `npm run verify:restore -- <folder>` | Restore into a temp DB and compare counts (safe test) |
| `npm run stats:db` | Print DB size + per-collection breakdown |

### Frontend (`cd web-storefront`)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check + production build |
| `npm run preview` | Preview the production build |

---

## Database Backup & Restore

Safe, verified backup workflow (no data loss):

```bash
cd backend

# 1. Create a full backup + auto-verify
npm run backup:full

# 2. Prove the backup restores correctly (uses a TEMP db, never touches live data)
npm run verify:restore -- backups/primexpc_YYYY-MM-DDTHH-MM-SS

# 3. Restore into any database (local or Atlas) by pointing DB_URL at it
#    PowerShell:
$env:DB_URL="mongodb+srv://user:pass@cluster.mongodb.net/primexpc"
npm run restore:db -- backups/primexpc_YYYY-MM-DDTHH-MM-SS
```

- `backup:full` writes every collection to JSON + a `manifest.json` and re-reads files to verify counts.
- `verify:restore` restores into `primexpc_restore_test`, compares every collection count against the manifest, then drops the temp DB.

---

## Image / Upload Storage

Product images and videos are stored on disk (Multer) and served from `/uploads`.

- **Local dev:** defaults to `backend/uploads` (`process.cwd()/uploads`).
- **Production (recommended):** set `UPLOADS_DIR` to a **persistent** absolute path **outside** the deployment/build folder so uploads survive every redeploy. Example on Hostinger:

  ```
  UPLOADS_DIR=/home/uXXXXXXXX/domains/primexpc.com/uploads
  ```

  Then upload existing media into that folder (same filenames) — the database references images as `/uploads/<filename>`.

Uploaded files are **not** committed to Git (see `.gitignore`); they live in the persistent folder above.

---

## API Overview

Base URL: `/api`

| Group | Endpoints |
|-------|-----------|
| **Auth** | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `GET /auth/refresh` |
| **Products** | `GET /products`, `GET /products/public/featured`, `GET /products/:id` |
| **Categories** | `GET /categories`, admin CRUD |
| **Cart** | `GET /cart`, `POST /cart`, `PUT /cart/:id`, `DELETE /cart/:id`, `DELETE /cart`, `POST /cart/merge` |
| **Orders** | `POST /orders`, `GET /orders` |
| **Payment** | `POST /payment/create-order`, `POST /payment/verify`, `POST /payment/place-order`, `POST /payment/webhook` |
| **Reviews** | `POST /reviews`, `DELETE /reviews/:id` |
| **Users** | addresses CRUD, wishlist CRUD |
| **Settings** | `GET/PUT /admin/settings`, public key, footer, banners, GST rates, test-email |
| **Shipping** | `GET /shipping` (rates by pincode) |
| **Shiprocket** | push order, track, label, cancel |
| **Sell (buyback)** | `/sell`, `/admin/sell`, `/public` |
| **Pages** | public list, by slug, admin CRUD |
| **Other** | `GET /api/health`, `GET /sitemap.xml`, `GET /robots.txt` |

---

## Deployment

The app is designed to run as a **single Node.js web app** (backend serves the API + built frontend).

### Build

```bash
cd backend
npm run build:web      # produces backend/dist
```

### Hostinger Node.js Web App

| Setting | Value |
|---------|-------|
| Repository | `serverahmd01-a11y/primexpc.com` |
| Branch | `main` |
| Root directory | `backend` |
| Node.js version | `22` |
| Entry file | `src/server.js` |
| Build command | *(none — `backend/dist` is committed)* |

**Environment variables to set in hPanel:**

```
NODE_ENV=production
DB_URL=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/primexpc
JWT_SECRET=<long-random-string>
CLIENT_URL=https://primexpc.com
UPLOADS_DIR=/home/uXXXXXXXX/domains/primexpc.com/uploads
```

Then:
1. Upload existing media to `UPLOADS_DIR` via File Manager / SFTP.
2. Point the domain's DNS A record to the Hostinger server (SSL: Full).
3. Update third-party webhooks:
   - Razorpay → `https://primexpc.com/api/payment/webhook`
   - Shiprocket → `https://primexpc.com/api/sell/webhook`

> **Database:** Hostinger web hosting does not provide MongoDB — use **MongoDB Atlas** (free M0 tier is plenty for this workload).

---

## License

This project is proprietary software developed for **PrimeX Technologies**. All rights reserved.
