# PrimeX PC — E-Commerce Platform Documentation

## Overview
A full-stack e-commerce platform for custom PC builds and components. Built with React 19 + TypeScript (frontend) and Node.js Express 5 + MongoDB (backend). Supports payment processing via Razorpay, shipping via Shiprocket, and email via SMTP.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript 6, Vite 8, Tailwind CSS v4 |
| Backend | Node.js, Express 5, Mongoose |
| Database | MongoDB |
| Payments | Razorpay |
| Shipping | Shiprocket |
| Email | Nodemailer (SMTP) |
| Auth | JWT + bcrypt |

---

## Pages / Routes

### Public Pages
| Route | Description |
|-------|-------------|
| `/` | Homepage — Hero section with animated logo, banner slider (auto-rotate 2s), Hot Deals (countdown), Category grid, All Products, CTA section |
| `/product/:id` | Product detail — Image gallery, video, pricing (incl. GST), add-to-cart, wishlist, related products |
| `/category/all` | All products — Filters by category, price range, condition, sort, search |
| `/category/:name` | Category-specific product listing |
| `/categories` | Category tree with multi-select filtering |
| `/cart` | Shopping cart — Quantity controls, GST breakdown, order summary |
| `/checkout` | Checkout — Contact info, shipping address (with saved addresses), payment method (Online / COD), Razorpay integration, downloadable invoice |
| `/auth` | Sign In / Sign Up |
| `/profile` | User profile — Saved address management (CRUD) |
| `/orders` | Order history |
| `/page/:slug` | CMS pages (About Us, Privacy Policy, etc.) |
| `/sitemap` | Site navigation map |
| `/contact` | Contact page |

### Admin Pages (`/admin/*`)
| Route | Description |
|-------|-------------|
| `/admin` | Dashboard — Revenue, orders, customers, products stats |
| `/admin/products` | Products CRUD — Name, price, stock, sale price, GST rate, condition, category, specs, images, video |
| `/admin/categories` | Categories CRUD with tree view, image, condition assignment |
| `/admin/orders` | Orders list with status management |
| `/admin/orders/:id` | Order detail — Shiprocket push, AWB tracking, label PDF |
| `/admin/customers` | Customers list |
| `/admin/customers/:id` | Customer detail + order history |
| `/admin/settings` | Settings — Razorpay, Shiprocket, SMTP, store info, GST rates, social links, footer links, banner images (up to 6) |
| `/admin/gst` | GST management — Tax rates, product distribution, stock value per rate |
| `/admin/pages` | CMS pages CRUD |

---

## Key Features

### 1. Product Management
- Full CRUD with image upload (up to 3), video support
- Specifications (key-value pairs)
- GST rate per product (default 18%)
- Condition: New / Refurbished
- Featured / Hot Deal with sale price + countdown timer
- Stock tracking

### 2. Category Management
- Hierarchical tree (parent-child) with unlimited nesting
- Condition filtering (new / refurbished / both)
- Image per category
- Seed defaults (12 categories)

### 3. Cart & Checkout
- Guest cart (localStorage) + server cart sync on login
- GST breakdown by tax rate
- Inclusive pricing (price shown includes GST)
- Payment: Razorpay (UPI, Cards, Net Banking) or COD (20% advance)
- Order confirmation email
- Downloadable HTML invoice

### 4. Order Management
- Status workflow: pending → shipped → delivered
- COD advance payment tracking
- Shiprocket integration (push order, track AWB, print label PDF)
- Automated status emails

### 5. User System
- JWT authentication with auto-refresh
- Address book (multiple saved addresses with label)
- Wishlist
- Order history with review capability
- First registered user auto-promoted to admin

### 6. Admin Panel
- Dashboard with revenue/stats
- Full product, category, order, customer, page management
- Settings for payments, shipping, email, store info
- Banner upload (up to 6 images for homepage slider)
- GST rate configuration
- Social & footer links management

### 7. Banner Slider
- Admin uploads up to 6 images via settings
- Auto-rotates every 2 seconds
- Manual navigation arrows + dot indicators
- Displayed on homepage below hero section

### 8. Search
- Live typeahead search in header
- Shows product image, name, category, price
- "View all results" link to full search page

### 9. CMS Pages
- Dynamic content pages (About Us, Privacy Policy, etc.)
- Admin creates/edits/toggles active status
- Rendered at `/page/:slug`

### 10. Invoice Download
- After successful checkout, downloadable HTML invoice
- Shows: order ID, date, item table, price, GST (18%), total
- Store branding included

### 11. Sitemap
- Dynamic XML sitemap at `/sitemap.xml` for SEO
- Frontend sitemap page for user navigation

---

## API Endpoints Summary

| Group | Endpoints |
|-------|-----------|
| Auth | POST register, POST login, GET me, GET refresh |
| Products | GET list, GET featured, GET by ID |
| Categories | GET list, CRUD (admin) |
| Cart | GET, POST add, PUT qty, DELETE remove, DELETE clear, POST merge |
| Orders | POST create, GET user orders |
| Payment | POST create-order, POST verify, POST place-order, POST webhook |
| Reviews | POST create/update, DELETE |
| Users | Addresses CRUD, Wishlist CRUD |
| Settings | GET/PUT (admin), GET public key, GET footer, GET banners, GET GST rates, POST test-email |
| Shipping | GET rates by pincode |
| Shiprocket | POST push order, GET track, GET label, POST cancel |
| Pages | GET public, GET by slug, CRUD (admin) |
| Other | GET health, GET sitemap.xml |

---

## Database Models
- **User** — email, name, password (hashed), role, addresses, wishlist
- **Product** — name, description, price, stock, category, subCategory, images, video, specs, gstRate, condition, featured, salePrice, dealEndsAt
- **Category** — name, parent, description, image, condition
- **Order** — user, items, shipping address, payment, status, Shiprocket tracking
- **Cart** — user/guestId, items
- **Review** — product, user, order, rating
- **Setting** — key-value pairs for all configurable settings
- **Page** — title, slug, content, active, sortOrder

---

## Integrations
- **Razorpay** — Online payments (UPI, Cards, Net Banking), COD advance payment, webhook
- **Shiprocket** — Order fulfillment, tracking, shipping label PDF
- **SMTP Email** — Order confirmation, shipping notification, delivery confirmation
- **WhatsApp** — Click-to-chat floating button

---

## Setup Instructions

### Backend
```bash
cd backend
npm install
# Configure backend/.env:
#   NODE_ENV=development
#   PORT=3000
#   DB_URL=mongodb://localhost:27017/primexpc
#   JWT_SECRET=your-secret-key
#   CLIENT_URL=http://localhost:5173
npm run dev
```

### Frontend
```bash
cd web-storefront
npm install
# Configure web-storefront/.env:
#   VITE_API_URL=http://localhost:3000/api
npm run dev
```
