# Overview

Copointo is a pnpm/TypeScript monorepo: a coffee ordering & loyalty platform for Oman (Arabic-first, RTL). It has a customer mobile app (`copointo`, Expo), a cafe-owner admin dashboard (`admin`, React+Vite), and an Express API backend (`api-server`).

**Key capabilities:**
- Mobile ordering (dine-in / car), table booking, and an AI assistant (Copointo Bot) that guides ordering & booking.
- Loyalty & gamification: levels, ranks, coins, and free-coffee rewards.
- Social: user↔user and user↔cafe messaging (with media), communities, broadcast notifications.
- Cafe management: menus, orders, tables, inventory, discount codes, analytics, QR/barcodes, TikTok-style reels.
- Location: map of nearby cafes; cafe ratings.
- Online payments via OMPay (currently buy-coins only).

# User Preferences

I want iterative development. Ask before making major changes.

# System Architecture

**Stack:** Node 24 · pnpm workspace · TypeScript 5.9 · Express 5 · PostgreSQL + Drizzle ORM · Zod (`zod/v4`) + `drizzle-zod` · Orval codegen (from OpenAPI) · esbuild · Expo (React Native).

**Mobile auth & persistence:** Local AsyncStorage-based register/login with a global auth gate; server enforces `gameUsername` uniqueness and mirrors users for super-admin visibility. Most messaging/users endpoints follow a client-supplied-userId mock-auth pattern (tightening to real auth is a project-wide follow-up).

## UI/UX

- **Brand logo:** Copointo droplet replaces the old `☕`/`Coffee` mark.
  - Admin (Vite): `import logoUrl from "@/assets/copointo-logo.png";` → `<img src={logoUrl} className="object-contain" />`
  - Mobile (Expo): `<Image source={require("../assets/images/copointo-logo.png")} style={{ resizeMode: "contain" }} />`
- **Theme:** Pure-black background with amber-glow (`#E8B86D`) throughout the mobile app; dark cards/borders on Cart, Cafe, Order, Conversation, Profile screens.
- **RTL:** Arabic-first; invoices and UI built for RTL.
- **i18n (AR/EN):** `i18n/translations.ts` (flat keys, `{placeholder}` interpolation) via `context/LanguageContext.tsx` → `useT()` hook; choice persisted in AsyncStorage. Globe toggle in the home header. Rolled out screen-by-screen (not yet 100% complete).
- **Admin dashboard:** Tab-based management (Invoices, Expenses, Templates, Inventory, Reels, Discount Codes, Barcode/QR) + a gold-crown password-protected manager analytics view.

## Features (summary)

- **AI chatbot:** Data-aware (menu/tables/chat), guided order & booking flows; conversation persisted per cafe; clearable from the header.
- **Ordering:** In-app cart wizard, real-time menu, status tracking. Supports per-product discounts (`originalPrice`), buy-X-get-Y promos, and bean/size variants — all carried through cart, chat order, invoices.
- **Table booking:** Hourly pricing, admin approval, time-slot management, invoice on confirmation.
- **Loyalty:** Free coffee every 7 paid drinks, redeemable only at the earning cafe (atomic two-phase commit). Progress is credited at invoice print, not order confirmation.
- **Inventory / discount codes / reels / ratings / expenses & invoice templates / broadcast notifications** — managed from the admin dashboard.
- **Cafe dashboard extras:** Edit order, direct (walk-in) in-cafe order, barcode/QR tab, 2-step reels upload wizard.
- **Super-admin:** Edit cafe; ban (soft-block) vs hard-delete (full PII purge); view users' owned cosmetics as shapes.
- **Chat media:** Image / video / voice-note attachments with recording timer, pre-send preview, and sender chips; stored in object storage, served with HTTP Range.
- **Showcase demo account:** Hidden login (`Copointo`) seeds a demo world (cafes, users, reels, communities) visible only to that account; all demo rows flagged `showcaseOnly` and filtered from real users.

## Payments (OMPay)

- Online card payment via OMPay Bank-Hosted checkout. Wired for **buy-coins only**; orders/bookings stay cash for now (online will be optional later).
- Adapter in `api-server/src/lib/ompay.ts`; routes in `routes/payments.ts`. Dormant unless `OMPAY_API_KEY/SECRET/MERCHANT_ID` are set; `OMPAY_ENV=production` switches PROD vs UAT hosts.
- Currently on **UAT** (test). Going live needs production OMPay credentials + registering the webhook (`/api/payments/ompay/webhook`) during onboarding.
- Buy-coins prices are shown in **USD** but converted to **OMR** before charging (rate constant in `app/buy-coins.tsx`).

# External Dependencies

- **OMPay** — payment gateway (Oman).
- **OpenStreetMap / Leaflet** — cafe map (rendered via iframe/webview).
- **Google Maps API** — `locationUrl` generation from cafe coordinates.
- **Twilio** — (integration installed).
- **Object storage (GCS)** — chat media, reels.
- **Expo / react-native-webview / Ionicons** — mobile framework & UI.
