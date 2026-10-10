# Dual POS Architecture & Roadmap

This document outlines the architecture, roadmap, and transition strategy for building both the **Cloud SaaS Restaurant POS** and the **Offline-First Desktop App (FloCafe)**.

Both systems are based on **100% MIT-licensed codebases**, giving full legal rights to modify, rebrand, commercialize, and host as a proprietary SaaS or standalone product.

---

## 1. Projects Overview

| Property | Project 1: Cloud SaaS POS | Project 2: Offline Desktop POS |
| :--- | :--- | :--- |
| **Foundation** | [Restaurant_POS_System](https://github.com/amritmaurya1504/Restaurant_POS_System) (MERN) | [FloCafe](https://github.com/FreeOpenSourcePOS/FloCafe) (Electron + Next.js) |
| **License** | **MIT** | **MIT** |
| **Primary Goal** | Multi-tenant Web SaaS (monthly subscriptions) | Local hardware terminal, offline-first reliability |
| **Target Customers** | Restaurants, food chains, multi-location operators | Cafes, food trucks, venues with unstable internet |
| **Tech Stack** | React, Node.js / Express, MongoDB / PostgreSQL | Next.js 16, React 19, Electron, SQLite, Express |
| **Current Status** | **Phase 1: Starting Now** | Cloned & ready in workspace (`restaurant-pos`) |

---

## 2. Phase 1: Cloud SaaS Architecture Plan

### Core Modules
1. **Multi-Tenancy & Auth:**
   - Multi-tenant data segregation (`tenant_id`, `restaurant_id`, `branch_id`).
   - Role-Based Access Control (Owner, Manager, Cashier, Waiter, Kitchen Staff).
   - Subscription billing integration (Stripe / LemonSqueezy).

2. **Dine-in & Ordering:**
   - Visual floor plan and table status tracking (Vacant, Occupied, Billed).
   - Digital menu with categories, modifier groups, and add-ons.
   - Quick takeaways and delivery orders.

3. **Live Kitchen Display System (KDS):**
   - Real-time ticket dispatching via WebSockets / Server-Sent Events.
   - Ticket stage progression: `Received` ➔ `Preparing` ➔ `Ready` ➔ `Served`.

4. **Billing & Payments:**
   - Split bills, itemized discounts, taxes, and service charges.
   - Digital payments, cash change calculation, and receipt generation.

5. **Manager Portal & Analytics:**
   - Live revenue dashboard, top-selling items, server speed, and inventory rundown.

---

## 3. Phase 2: Desktop Offline-First App (FloCafe Roadmap)

> **Repository State:** Already cloned in this directory.

### Key Characteristics of FloCafe:
- **Backend:** Express API on `:3001`, KDS server on `:3002`, Server App on `:3003`.
- **Database:** Local SQLite via `better-sqlite3`.
- **Frontend:** Next.js static export (`output: 'export'`) with React 19 inside Electron.
- **Hardware Integration:** ESC/POS direct thermal printing (USB, Bluetooth, Network).

### Future Hybrid Sync Concept (SaaS + Desktop):
- The desktop app can serve as the **local edge terminal** that syncs transactions back up to your SaaS cloud database whenever internet connectivity is restored.

---

## 4. Immediate Next Steps for SaaS

1. Choose the SaaS storage and repository location (separate directory or branch).
2. Set up the multi-tenant SaaS backend with authentication and database schema.
3. Build the customer/cashier web ordering and KDS frontend.
