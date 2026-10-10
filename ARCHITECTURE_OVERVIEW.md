# FloCafe — Architecture & High-Level System Overview

FloCafe is an **offline-first, open-source restaurant and cafe Point of Sale (POS) system** licensed under the **MIT License**. It is engineered to operate completely offline on local hardware while supporting multi-device local networks (KDS, Waiter App, Customer Display) and optional cloud sync capabilities.

---

## 1. High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DESKTOP CLIENT                                  │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │               Electron Shell (Lifecycle, Window, IPC)              │   │
│   └──────────────────────────────────┬──────────────────────────────────┘   │
│                                      │                                      │
│      ┌───────────────────────────────┴───────────────────────────────┐      │
│      │                                                               │      │
│      ▼                                                               ▼      │
│ ┌───────────────────────────┐                 ┌───────────────────────────┐ │
│ │  Frontend (Next.js 16)    │                 │   Backend Express Services│ │
│ │  - React 19 + Tailwind    │                 │   - API Server (:3001)    │ │
│ │  - Zustand Store          │ ◄─── HTTP / ──► │   - KDS Standalone (:3002)│ │
│ │  - Static Export / SSR    │      WebSocket  │   - Server App (:3003)    │ │
│ └───────────────────────────┘                 └─────────────┬─────────────┘ │
│                                                             │               │
│                                                             ▼               │
│                                               ┌───────────────────────────┐ │
│                                               │ SQLite (better-sqlite3)   │ │
│                                               │ - Schema & Migrations     │ │
│                                               │ - Local Orders & Products │ │
│                                               └─────────────┬─────────────┘ │
└─────────────────────────────────────────────────────────────┼───────────────┘
                                                              │
                     ┌────────────────────────────────────────┴────────────────────────────────────────┐
                     ▼                                        ▼                                        ▼
         [ ESC/POS Thermal Printers ]              [ Optional Cloud Sync ]                   [ Local Network Devices ]
         - USB / Network / Serial                  - Google Drive Backups                    - Kitchen Display (KDS)
         - Direct Byte Emitted                     - WhatsApp Billing Notifications          - Server / Waiter Terminals
```

---

## 2. Core Subsystems

### A. Main Process (`main/`) — Node.js & Electron
- **Electron Lifecycle (`main/index.ts`):** Manages native window creation, OS-level menus, background service daemons, and system power events.
- **Express API Server (`main/server.ts` on port `3001`):** The primary backend API serving business logic, orders, menu items, shifts, and inventory.
- **Standalone KDS Server (`main/kds-server.ts` on port `3002`):** Serves real-time Kitchen Display screens over the local network via WebSockets.
- **Server App (`main/server-app.ts` on port `3003`):** Mobile waiter order-taking application for local LAN handheld devices.
- **Database Engine (`main/db.ts`):** Direct SQLite database access using `better-sqlite3`. Includes automatic schema migrations, data safety locks, and zero-latency transactions.
- **Printing Engine (`main/print/` & `main/printers/`):** ESC/POS thermal printer driver supporting Network (TCP/IP), USB, and Serial printers with raw byte rendering and cash drawer kick.

### B. Frontend (`frontend/src/`) — Modern Web Client
- **Framework:** Next.js 16 + React 19.
- **Design & Styling:** Tailwind CSS + custom UI components (`shadcn/ui` style).
- **State Management:** Zustand stores with optimistic UI updates.
- **Build Mode Flexibility:**
  - **Desktop Build:** Exported as static HTML/JS (`output: 'export'`) packaged inside Electron.
  - **Browser/Cloud Runtime:** Standard server runtime for browser development or web hosting.

---

## 3. Screen Structure & Feature Map

The dashboard (`frontend/src/app/(dashboard)/`) contains the following modules:

| Route | Module | Purpose |
| :--- | :--- | :--- |
| `/pos` | **Point of Sale** | Fast cashier checkout, category grid, product variants, cart, modifiers, and payment processing. |
| `/tables` | **Floor Plan & Tables** | Visual table layout, seat allocation, order transfer, bill splitting, and table status. |
| `/kds` | **Kitchen Display** | Live kitchen order queue with ticket progression (`Received` ➔ `Preparing` ➔ `Ready` ➔ `Served`). |
| `/orders` | **Order Management** | Order history, receipts, status filters, voids, refunds, and re-prints. |
| `/products` | **Catalog & Menu** | Product definitions, pricing, tax rates, images, barcodes, and categories. |
| `/addon-groups` | **Modifiers & Add-ons**| Customization groups (e.g. Size, Milk options, Extra toppings). |
| `/inventory` | **Inventory & Stock** | Ingredient tracking, stock levels, adjustments, and runout alerts. |
| `/customers` | **Customer CRM** | Customer database, order history, credit balance, and loyalty. |
| `/staff` | **Staff & Roles** | Cashier/Manager PINs, permissions, and shift clocks. |
| `/expenses` | **Cash & Expenses** | Cash drawer in/out, petty cash management, and shift reconciliation. |
| `/whatsapp` | **WhatsApp Receipts** | Digital receipt delivery via WhatsApp Web automation. |
| `/settings` | **System Configuration**| Tax packs, printer assignments, store profile, and localization. |

---

## 4. Operational Invariants & Rules

1. **Offline-First Guarantee:** Core operations (taking orders, firing tickets to kitchen, printing receipts) never block on network connectivity.
2. **Backend Authority:** Pricing, discount rules, tax calculations, and payment validations are strictly executed on the backend to prevent discrepancies.
3. **Open Order Visibility:** All authenticated staff members can view and service open tickets; accountability is tracked via comprehensive audit logs rather than restricting visibility.
4. **Port Allocation:**
   - `:3000` — Frontend Web UI
   - `:3001` — Core REST API
   - `:3002` — Kitchen Display System (KDS)
   - `:3003` — Server / Waiter App
