# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Artifacts

### Copointo Mobile App (`artifacts/copointo`)
- **Type**: Expo (React Native) mobile app
- **Preview Path**: `/`
- **Description**: Full-featured coffee ordering platform for Oman
- **Features**:
  - Home screen with cafe listings, search, and category filter
  - Cafe detail with menu (hot/cold/dessert), cart, and ordering
  - AI Chat (Copointo Bot) per cafe
  - Table booking with time slots
  - TikTok-style vertical video feed
  - Messaging hub (user-to-user and user-to-cafe)
  - Copointo Game with 1000 levels, 10 rank tiers, free coffee every 7 levels
  - User profile with level/rank progress; tapping the rank pill opens a "Ranks Journey" modal listing all 10 ranks with cups remaining to reach each one
  - Shopping cart with order management
- **State**: AsyncStorage for all persistence (no backend needed for first build)
- **Colors**: Pure-black + amber-glow (#E8B86D) theme applied app-wide. Color tokens live in `constants/colors.ts` (both light and dark palettes share the same black/amber values) and are consumed via `useColors()` for Home/Messages/tab-bar/cafe screens. Screens that keep their own constants (Cart, Cafe detail, Order, Conversation, Competitor Profile, Notifications, Add-friend, Leaderboard, Profile, Game) all use BG=#000, CARD=#0A0606, BORDER=rgba(232,184,109,0.25–0.35), PRIMARY=#E8B86D. Profile has a double glowing ring around the avatar showing the level number; Game uses diamond-shaped tiles with amber borders + lock icons + dotted amber connectors + purple Leaderboard FAB.
- **Data**: Mock data in `data/mockData.ts` (CAFES, VIDEOS, RANKS). `PRODUCTS` is empty — every cafe's menu is now loaded from the admin dashboard via `GET /api/cafe/:id/menu`. `MESSAGES` and `CHAT_HISTORY` are also empty — all conversations are derived from real friend connections.
- **Cafe Order Flow** (`app/cafe/[id]/order.tsx` → `app/cart.tsx` → `app/order-timer.tsx`): the order screen fetches the live menu from the API and renders gold-themed cards grouped by Arabic categories (قهوة / حلى / مشروبات / أكل) with inline quantity controls. The cart wizard collects: dine-in vs car → table number OR plate number (1-4 digits) + Arabic plate symbols → customer name + phone → confirm. On submit it `POST /api/cafe/:id/orders` (no invoice yet, status `pending`) then routes to `order-timer.tsx`, which shows a pulsing amber ring counting 100.0 → 0.0 over `prepMinutes = 3 × drink-count` minutes (drinks = items where `category !== "حلى"`) and polls `GET /api/cafe/:id/orders/:orderId` every 4s. When the manager confirms the order in the admin dashboard, the timer screen detects the status change, awards `+drinks` cups & `+drinks*10` points to the local user, and shows the success view (table # or plate). Booking screen (`app/cafe/[id]/book.tsx`) loads real tables from `/cafe/:id/tables` and `POST`s to `/cafe/:id/bookings`.
- **Per-café game progress** (in `AppContext`): each user's progress in the Game tab is tracked **independently per café** rather than globally. `User.cafeProgress: Record<cafeId, { cafeName, totalOrders, level }>` stores level + order count for every café the user has ordered from. `addCafeOrder(cafeId, cafeName, qty)` (called from `order-timer.tsx` when the manager prints) increments only that café's counters (and keeps `user.totalOrders` / `user.points` aggregates for leaderboard/profile). `activeGameCafeId` (persisted as `activeGameCafeId:<uid>`) selects which café's progress is currently displayed in the Game tab. The game header shows that café's name in a tappable amber pill above the progress bar; tapping it opens `app/my-cafes.tsx`. The new "كوفيهاتي" FAB on the Game tab (between Communities and the Leaderboard, with a gold count badge) opens the same screen, which lists every café the user has ordered from with its name, rank, level, and total orders. Each row has "عرض في اللعبة" (sets active café and returns to game) and "دخول الكوفي" (navigates to the café page). Order navigation params (`cart.tsx`, `cafe/[id]/order.tsx` active-order banner) now include `cafeName` so `order-timer.tsx` can pass it to `addCafeOrder`.
- **Communities** (in `CommunityContext`): clan-style groups for the Game tab. A `Community` (in `mockData.ts`) has 2-50 members with a score equal to the sum of all members' `totalOrders`. Per-user storage keys: `copointo_communities_v1:<uid>` and `copointo_community_invites_v1:<uid>`. Cross-user mock: writes directly to other members' AsyncStorage (mirroring the `MessagesContext` pattern). Joining requires accepting an invite — only the creator can invite at creation time, and (later) any member can be invited via `inviteToCommunity`. If the creator leaves, the oldest remaining member is promoted. Screens: `app/communities.tsx` (tabs: مجتمعاتي + الترتيب — sorted by score), `app/create-community.tsx` (name + avatar + friends), `app/community-info.tsx` (stats, members, edit name/avatar by creator, kick by creator, leave), `app/community-invites.tsx` (accept/decline). Game tab gets a third small FAB (users icon, between user-plus and the purple Leaderboard) with a red badge showing pending invite count.
- **Auth**: Local AsyncStorage-based register/login. `User` has optional `avatar?: string` and `gender?: "male" | "female"`. The `setUser()` mutator in `AppContext` keeps both `currentUser` and the matching entry in `registeredUsers` in sync (state + AsyncStorage), so profile edits (avatar, etc.) propagate to the leaderboard, game header, friends list, and competitor profile, and persist across logout/login.
- **Friend requests** (in `AppContext`): friendships now require explicit acceptance. Per-user keys `friend_requests_in:<uid>` and `friend_requests_out:<uid>` plus `friends:<uid>` are written to AsyncStorage. `sendFriendRequest`, `acceptFriendRequest`, `declineFriendRequest`, `cancelFriendRequest`, and `refreshFriendData` are exposed via `useApp()`. Cross-user mock sync is achieved by writing directly to the other user's storage keys (since the device is shared between test users). Leaderboard shows three button states next to each row: amber "+" (no relationship), dashed amber "⏳ معلّق" (request pending — tap to cancel), green "✓" (other user requested me — tap to accept). Notifications screen lists all incoming requests with "قبول" / "رفض" actions.
- **Messaging** (in `MessagesContext`): conversation list is derived from `useApp().friends` × `registeredUsers`. Conversation IDs use the format `friend_<friendId>`. Storage keys are per-user (`copointo_chats_v2:<uid>` and `copointo_unread_v2:<uid>`) so each test user keeps an isolated inbox. When a user sends a message (`fromMe=true`), `appendMsg` mirrors a copy with `fromMe=false` into the recipient's storage to mock cross-device delivery; the messages and conversations tabs call `refreshChats` on focus to pick up incoming mirrored messages. Brand-new conversations show the placeholder "صديق جديد — ابدأ المحادثة 👋" until the first real message lands. Sent bubbles use amber background (#E8B86D) with black text and dark ticks.
- **Groups** (chat groups, also in `MessagesContext`): user-created group chats (`Group` interface in `mockData.ts`) with name + optional avatar + selected friends. FAB on the messages tab opens `app/create-group.tsx`. Conversation IDs for groups use `group_<id>`; tapping a group opens `conversation.tsx?type=group&id=...` which shows sender labels/avatars on incoming messages. Tapping the conversation header opens `app/group-info.tsx` for managing members.

## Manager Analytics (Admin Dashboard)

The cafe dashboard (`artifacts/admin/src/pages/CafeDashboardPage.tsx`) has a special **gold crown button** in the tab row labeled "إحصائيات المدير". Clicking it now navigates to a **dedicated full-page route** at `/cafe/:id/analytics` (`ManagerAnalyticsPage`, exported from the same file), which first asks for the `managerPassword` set when the cafe was registered (verified server-side via `POST /api/cafe/:id/auth`). Once unlocked it shows a full analytics view powered by `POST /api/cafe/:id/advanced-stats` (also password-protected): daily/monthly/yearly revenue (area chart with period switcher), top products & categories (pie + ranked list), order type pie (dine-in vs car), order source pie (direct vs chat), busiest weekday bar, booking status pie, visit→order conversion stats, complete invoice table, and a players ranking table that joins each customer's phone with their global Oman rank (sorted by `totalOrders`). Cafe-detail page views are tracked from the mobile app via `POST /api/cafe/:id/track-view` (called on mount in `artifacts/copointo/app/cafe/[id].tsx`). View records, plus a `source: "direct"|"chat"` field on `Order`, live in the in-memory store (`artifacts/api-server/src/store.ts`).

## Invoice Templates & Expenses

Every cafe has **5 customizable invoice templates** (one per type: `order`, `expense`, `daily`, `monthly`, `yearly`) plus a full **expense-tracking module**.

**Server (`artifacts/api-server/src/store.ts` + `routes/cafe-dashboard.ts`):**
- `InvoiceTemplate { cafeId, type, logo, cafeName, commercialReg, contactPhone, promoText, updatedAt }` — one record per (cafe, type). `GET /invoice-templates` returns all 5 (defaults derived from cafe info if not yet edited); `GET/PUT /invoice-templates/:type` for individual types; invalid types → 400.
- `Expense { id, cafeId, title, amount, category, notes?, date, createdAt }`. CRUD: `GET /expenses`, `POST /expenses` (validates positive amount + required title/category), `DELETE /expenses/:expenseId`.

**Admin Dashboard (`artifacts/admin/src/pages/CafeDashboardPage.tsx`):**
Three new tabs added to the existing tab strip:
1. **"الفواتير"** (rebuilt `InvoicesTab`) — date pickers for daily / month picker for monthly / year input for yearly; each has a Print button that fetches data + the matching template, aggregates orders by client-side category classification (حلى / مشروبات ساخنة / مشروبات باردة / طعام / أخرى via regex on item name), subtracts expenses for monthly/yearly, and opens a print window (`openPrintWindow`).
2. **"المصاريف"** (`ExpensesTab`) — add/list/delete expenses, with "طباعة فاتورة" per expense using the `expense` template.
3. **"تعديل الفواتير"** (`TemplatesTab`) — 5 buttons (one per type); selecting one renders `TemplateForm` with logo upload (base64, max ~700KB), cafe name, commercial registration, contact phone, promotional text. Saved via `PUT /invoice-templates/:type`.

**Print invoice rendering** — shared helpers `tplHeaderHtml`, `tplFooterHtml`, `openPrintWindow` (top of file) ensure all invoice types share the same header/footer style. `OrdersTab.printInvoice` now fetches the `order` template before rendering instead of hardcoding "Copointo".

**Layouts (per request):**
- **Order invoice** — header (logo/name/CR/phone) → customer + table/car info → items table → total → promo footer.
- **Daily invoice** — header → all orders table (id/customer/datetime/amount) → totals by category table → grand total → footer.
- **Monthly/Yearly invoice** — header → order count → category breakdown → revenue total → expenses total (if any, in red) → net → footer.
- **Expense invoice** — header → date + category info → expense detail row → notes → total → footer.

## Discount Codes

Each cafe can issue **digit-only** promo codes from the new "أكواد التخفيض" tab in the cafe dashboard. Codes have a fixed percent (10/20/30/40/50), an expiry date, and a `usedCount`. Server endpoints (in `artifacts/api-server/src/routes/cafe-dashboard.ts`):
- `GET /api/cafe/:id/discount-codes` — list
- `POST /api/cafe/:id/discount-codes` — create (validates digits-only, percent ∈ {10,20,30,40,50}, no duplicate active code)
- `DELETE /api/cafe/:id/discount-codes/:codeId` — delete
- `POST /api/cafe/:id/discount-codes/validate` — `{code}` → `{valid, percent, codeId}` (used by the mobile cart)

The mobile cart (`artifacts/copointo/app/cart.tsx`) shows an optional discount-code field above the order summary on the customer-info step. On apply it calls `/discount-codes/validate`; on success it shows the savings and a green confirmation, and the final total updates live. The order POST sends `discountCode` along with the rest of the payload — the server re-validates the code, computes `subtotal`/`discountPercent`/`discountAmount`, overrides `total`, and increments the code's `usedCount`. A bad/expired code returns `400` with Arabic error "كود التخفيض غير صالح أو منتهي". Data model: `DiscountCode` interface and the new `subtotal`/`discountCode`/`discountPercent`/`discountAmount` fields on `Order` live in `artifacts/api-server/src/store.ts`.

### Orders tab — manager actions

Each pending order row in the dashboard's **Orders** tab has two distinct buttons:
1. **"تأكيد تحضير الطلب"** (gold) — calls `PATCH /api/cafe/:id/orders/:orderId/status` with `"preparing"`. The server sets `confirmedAt`, creates an `Invoice` (idempotent — only on the first transition out of `pending`), and bumps the customer's `totalOrders` by the number of drinks (items where `category !== "حلى"`).
2. **"طباعة فاتورة"** — opens a print-ready RTL Arabic invoice in a new window (Copointo header, customer info, item table, total in OMR) and auto-triggers `window.print()`.

Once preparing, follow-up buttons are "الطلب جاهز" → "تم التسليم" (also via `cafeOrderStatus`).

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/copointo run dev` — run Expo app

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
