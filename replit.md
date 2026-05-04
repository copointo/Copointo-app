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
  - Table booking with mandatory hourly pricing & approval flow
  - TikTok-style vertical video feed
  - Messaging hub (user-to-user and user-to-cafe)
  - Copointo Game with 1000 levels, 10 rank tiers, free coffee every 7 levels
  - User profile with level/rank progress; tapping the rank pill opens a "Ranks Journey" modal listing all 10 ranks with cups remaining to reach each one
  - Shopping cart with order management
- **State**: AsyncStorage for all persistence (no backend needed for first build)
- **Colors**: Pure-black + amber-glow (#E8B86D) theme applied app-wide. Color tokens live in `constants/colors.ts` (both light and dark palettes share the same black/amber values) and are consumed via `useColors()` for Home/Messages/tab-bar/cafe screens. Screens that keep their own constants (Cart, Cafe detail, Order, Conversation, Competitor Profile, Notifications, Add-friend, Leaderboard, Profile, Game) all use BG=#000, CARD=#0A0606, BORDER=rgba(232,184,109,0.25–0.35), PRIMARY=#E8B86D. Profile has a double glowing ring around the avatar showing the level number; Game uses diamond-shaped tiles with amber borders + lock icons + dotted amber connectors + purple Leaderboard FAB.
- **Data**: Mock data in `data/mockData.ts` (CAFES, VIDEOS, RANKS). `PRODUCTS` is empty — every cafe's menu is now loaded from the admin dashboard via `GET /api/cafe/:id/menu`. `MESSAGES` and `CHAT_HISTORY` are also empty — all conversations are derived from real friend connections.
- **Cafe Order Flow** (`app/cafe/[id]/order.tsx` → `app/cart.tsx` → `app/order-timer.tsx`): the order screen fetches the live menu from the API and renders gold-themed cards grouped by Arabic categories (قهوة / حلى / مشروبات / أكل) with inline quantity controls. The cart wizard collects: dine-in vs car → table number OR plate number (1-4 digits) + Arabic plate symbols → customer name + phone → confirm. On submit it `POST /api/cafe/:id/orders` (no invoice yet, status `pending`) then routes to `order-timer.tsx`, which shows a pulsing amber ring counting 100.0 → 0.0 over `prepMinutes = 3 × drink-count` minutes (drinks = items where `category !== "حلى"`) and polls `GET /api/cafe/:id/orders/:orderId` every 4s. When the manager confirms the order in the admin dashboard, the timer screen detects the status change, awards `+drinks` cups & `+drinks*10` points to the local user, and shows the success view (table # or plate). Booking screen (`app/cafe/[id]/book.tsx`) loads real tables from `/cafe/:id/tables` and `POST`s to `/cafe/:id/bookings`.

- **Table-booking pricing & approval flow** (added 2026-05-04):
  - **Cafe admin** (`TablesTab`) — when adding/editing a table, the **"⏱️ أسعار التواقيت" tier list is now MANDATORY** (red asterisk + helper text). The cafe defines (hours → price) tiers, e.g. 1h=2 OMR, 2h=3.5 OMR, 4h=6 OMR. Server enforces this in `POST/PATCH /tables` via `validateHourlyPricing` (rejects empty list with the Arabic message `"أسعار التواقيت مطلوبة — أضف على الأقل سعر ساعة واحدة"`).
  - **Customer mobile** (`book.tsx`) — picks a table → tier picker shows the cafe's hourly options → chooses one → guests counter is **capped to `table.capacity`** (the `+` button disables at max with an inline red warning). A live "💰 سعر الحجز النهائي" card shows the price as the user changes selection. POST sends `{tableId, hours, guests, time, ...}`; the server snapshots `cafeName`, `tableCapacity`, `hourPrice`, `totalPrice` onto the booking row.
  - **Approval flow** — submit creates a booking with `status:"pending"` and the success screen replaces the previous "✓ Booked" with three states (⏳ pending • ✅ confirmed • ❌ cancelled). The screen polls `/cafe/:id/bookings` every 5s; when the cafe admin taps "تأكيد" in `BookingsTab`, the customer sees the approval inline. The notifications screen also surfaces all three states (with poll-every-8s) using `GET /api/bookings?phone=` (new public endpoint in `routes/index.ts`).
  - **Booking → Invoice** — first transition to `confirmed` in `PATCH /bookings/:id/status` atomically creates an Invoice (`type:"booking"`, `id:"inv-bk-..."`, items=`[{name:"حجز طاولة N • H ساعة", qty:1, price:totalPrice}]`) and stamps `booking.invoiceId` + `confirmedAt`. The admin BookingsTab now exposes a 🖨️ **"طباعة فاتورة"** button on confirmed bookings (`printBookingInvoice`) using the same RTL receipt template as orders.
  - **Revenue aggregation** — `loadAggData` now also fetches bookings; `aggregateBookings(from,to)` filters confirmed bookings whose `confirmedAt`/`createdAt` falls in the window. Daily / Monthly / Yearly printable invoices append a "حجوزات الطاولات / Table Bookings" section with per-row breakdown (Tbl / Hrs / Pax / Amount), and totals roll up into "Total Revenue" → Net (after expenses).
- **Per-café game progress** (in `AppContext`): each user's progress in the Game tab is tracked **independently per café** rather than globally. `User.cafeProgress: Record<cafeId, { cafeName, totalOrders, level }>` stores level + order count for every café the user has ordered from. `addCafeOrder(cafeId, cafeName, qty)` (called from `order-timer.tsx` as soon as the manager confirms the order — the server sets `order.pointsAwarded=true` on the first transition out of `pending`, and the timer screen polls and awards locally on that flag) increments only that café's counters (and keeps `user.totalOrders` / `user.points` aggregates for leaderboard/profile). `activeGameCafeId` (persisted as `activeGameCafeId:<uid>`) selects which café's progress is currently displayed in the Game tab. The game header shows that café's name in a tappable amber pill above the progress bar; tapping it opens `app/my-cafes.tsx`. The new "كوفيهاتي" FAB on the Game tab (between Communities and the Leaderboard, with a gold count badge) opens the same screen, which lists every café the user has ordered from with its name, rank, level, and total orders. Each row has "عرض في اللعبة" (sets active café and returns to game) and "دخول الكوفي" (navigates to the café page). Order navigation params (`cart.tsx`, `cafe/[id]/order.tsx` active-order banner) now include `cafeName` so `order-timer.tsx` can pass it to `addCafeOrder`.
- **Menu stock tracking** (optional per item): `MenuItem` now has `stockQty?: number | null` (null = untracked / unlimited) and `initialStockQty?: number | null` (snapshot of last "restock" total, used as denominator for the 50% / 25% / 0% alert thresholds). Server (`routes/cafe-dashboard.ts`) normalizes `stockQty` on POST/PATCH (integer ≥ 0 or null), and any PATCH that includes `stockQty` resets `initialStockQty` to the new value (treated as a fresh restock baseline). **Order placement (`POST /cafe/:cafeId/orders`)** aggregates requested qty per item name, finds the matching tracked menu item in that cafe, returns `409 { error: "نفدت كمية ... — المتبقّي: N" }` if any item lacks stock, and otherwise atomically decrements `stockQty` by the ordered amount (untracked items are unaffected). Mobile cart already surfaces server errors via `Alert`. Admin (`MenuTab` in `CafeDashboardPage.tsx`) adds an optional "الكمية المتوفرة" field in the add/edit form, a colored stock pill on every menu row (gold = ok, yellow = ≤50%, red = ≤25%, dark-red = "نَفِد") that opens a `window.prompt` for quick restock (or `-` to clear tracking), and three banner alerts above the menu list grouping depleted / critical / warning items. Mobile (`cafe/[id]/order.tsx`) shows a green/yellow/red badge ("متوفر: X" / "كمية محدودة — متبقّي X" / "نَفِد المنتج") under each item; depleted items render a disabled red "x" button instead of the add button, and the qty `+` button is disabled once `cart.qty` reaches `stockQty`.
- **Communities** (in `CommunityContext`): clan-style groups for the Game tab. A `Community` (in `mockData.ts`) has 2-50 members with a score equal to the sum of all members' `totalOrders`. Per-user storage keys: `copointo_communities_v1:<uid>` and `copointo_community_invites_v1:<uid>`. Cross-user mock: writes directly to other members' AsyncStorage (mirroring the `MessagesContext` pattern). Joining requires accepting an invite — only the creator can invite at creation time, and (later) any member can be invited via `inviteToCommunity`. If the creator leaves, the oldest remaining member is promoted. Screens: `app/communities.tsx` (tabs: مجتمعاتي + الترتيب — sorted by score), `app/create-community.tsx` (name + avatar + friends), `app/community-info.tsx` (stats, members, edit name/avatar by creator, kick by creator, leave), `app/community-invites.tsx` (accept/decline). Game tab gets a third small FAB (users icon, between user-plus and the purple Leaderboard) with a red badge showing pending invite count.
- **Auth**: Local AsyncStorage-based register/login. `User` has optional `avatar?: string` and `gender?: "male" | "female"`. The `setUser()` mutator in `AppContext` keeps both `currentUser` and the matching entry in `registeredUsers` in sync (state + AsyncStorage), so profile edits (avatar, etc.) propagate to the leaderboard, game header, friends list, and competitor profile, and persist across logout/login.
- **Game username uniqueness (cross-device)**: Since accounts live in per-device AsyncStorage, the API server is the single source of truth for `gameUsername` uniqueness. `usernameRegistry: { username (lowercased), display, userId, claimedAt }[]` lives in `artifacts/api-server/src/store.ts` (persisted with the rest of the store) and two endpoints in `routes/index.ts` enforce it: `GET /api/usernames/check?username=&userId=` returns availability without mutating, and `POST /api/usernames/claim { userId, username }` reserves the name (case-insensitive, 3–24 chars) — returns 409 `{ error: "يوزر اللعبة مستخدم مسبقاً" }` on collision, or replaces the user's prior claim on rename (and also updates the matching `users[].username` so the super-admin reflects the new name). Mobile (`AppContext.tsx → claimGameUsername()`) calls claim inside `register()` BEFORE persisting locally, and the profile username modal (`app/(tabs)/profile.tsx`) calls claim before `setUser()`; failures show an Arabic Alert and abort the local update.
- **Server-side user mirror (super-admin visibility)**: The mobile app's `register()` now calls `POST /api/users/register { id, username, phone, joinedAt }` (after the username claim) so every signed-up player appears in the super-admin's "المستخدمون" page (`UsersPage.tsx`) — not only those who placed an order. The endpoint is **atomic**: it validates BOTH the username (3-24 chars, unique server-wide, returns 409 `"يوزر اللعبة مستخدم مسبقاً"`) and the phone (unique across different ids, returns 409 `"رقم الهاتف مسجّل مسبقاً"`) before mutating either collection, then commits the username claim + user row together. This guarantees a failed registration cannot leave an orphaned username claim or an orphaned user row. The endpoint is idempotent on `id` (refreshes username/phone in place but preserves `level`, `totalOrders`, ban flags, etc.), and is also called fire-and-forget on app startup (`loadData`) and after `login()` to backfill existing accounts that registered before this change. `syncUserToServer()` helper in `AppContext.tsx` wraps the call.
- **Cafes-on-the-map screen** (`app/cafes-map.tsx`): a new full-screen map listing every registered cafe. Entered via a gold-bordered button placed below the search bar on the home screen ("الكافيهات في الخريطة"). The home button first asks for location permission (uses existing if granted, otherwise prompts via `Location.requestForegroundPermissionsAsync`); permission denial is non-blocking — we still open the map so the user can see all cafe pins. The map itself is **cross-platform**: a self-contained Leaflet HTML page (built by `buildMapHtml(...)`, OpenStreetMap tiles, no API key) is rendered via `<iframe srcDoc>` on web and via `react-native-webview` on native (newly installed at `13.15.0` via `expo install`). Each cafe with `lat/lng` becomes a tappable gold ☕ pin; the user's current location appears as a pulsing blue dot. Pin taps `postMessage({ type: "cafe", id })` back to the host (handled via `WebView.onMessage` on native, `window.addEventListener("message", ...)` on web), which opens a bottom-sheet panel showing the cafe logo + name + address + a primary "زيارة صفحة الكوفي" button that routes to `/cafe/[id]`. Cafes without coordinates are silently skipped; if zero are plottable an empty state explains why. Map auto-fits bounds to all markers (with padding, max-zoom 14), centers on Muscat as fallback.
- **Cafe ratings (1-5 stars, optional)**: A new rating panel appears at the bottom of the cafe page (`app/cafe/[id].tsx`), below the chat action card. Five tappable stars (RTL-reversed so star 1 is on the right) let any logged-in user rate the cafe; submitting a rating again overwrites the previous one (server upserts). The header chip and panel sub-text show the live average + count (e.g. `4.5 (12)` or `بدون تقييم`). The cafe page now fetches the **single** cafe (`GET /api/cafes/:id`) so it always reflects the freshest server stats, and reloads the user's previous rating via `GET /api/cafes/:id/my-rating?userId=`. Server (`routes/index.ts` + `store.ts → cafeRatings: { cafeId, userId, stars, ratedAt }[]`): two new endpoints — `GET /api/cafes/:id/my-rating?userId=` (returns `{ stars }`, 0 if not yet rated) and `POST /api/cafes/:id/rate { userId, stars }` (validates whole stars 1-5, returns `{ ok, rating, ratingCount }`). The `getCafeRatingStats(cafeId)` helper computes avg (rounded to 1 decimal) + count from `cafeRatings`. The home list (`GET /api/cafes`) now **sorts cafes by rating descending** (then by ratingCount as tiebreaker), so the highest-rated cafes appear first and unrated ones (rating=0) drop to the bottom — no client-side change needed because the home list already maps the server order. `cafeRatings` is included in the persistence collections so ratings survive restarts.
- **Global auth gate** (`components/AuthGate.tsx`): wraps the entire app in `app/_layout.tsx` so EVERY entry into the app — including QR-code deep links to `/cafe/[id]` — first requires the user to log in or register. While `AppContext.hydrated` is false (initial AsyncStorage read in flight) the gate shows a spinner so the login screen does not flash for already-signed-in users. When `!user`, it renders a branded splash with a non-dismissible `<AuthModal dismissible={false}>` (no close button, back-press is a no-op) so the gate cannot be bypassed. After login the gate renders its children normally and expo-router preserves the original URL so the user lands on their intended destination (e.g. the cafe page from the QR code). The `AuthModal` itself was extracted from `app/(tabs)/profile.tsx` into `components/AuthModal.tsx` so both the profile screen and the gate share the same UI.
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

## Inventory (المخزن)

Each cafe has an **Inventory tab** (`📦 المخزن`) in the admin dashboard for tracking warehouse stock (coffee bags, equipment, syrups, …).

**Server (`artifacts/api-server/src/store.ts` + `routes/cafe-dashboard.ts`):**
- `InventoryItem { id, cafeId, name, initialQty, currentQty, unitPrice, totalCost, createdAt, depletedAt }` in `inventoryItems[]`.
- `GET /api/cafe/:id/inventory` → `{ active, depleted }` (split by `currentQty > 0`).
- `POST /api/cafe/:id/inventory` — body `{ name, initialQty, unitPrice }`; `totalCost = initialQty * unitPrice` snapshot at creation.
- `PATCH /api/cafe/:id/inventory/:itemId/decrement` — body `{ step? = 1 }`; sets `depletedAt` when `currentQty` first reaches 0; returns 400 if already depleted (no further edits possible).

**Admin (`artifacts/admin/src/pages/CafeDashboardPage.tsx` → `InventoryTab`):**
- Add form: name + count + unit price → live total (`count × price`) and timestamp captured server-side.
- "المنتجات الحالية في المخزن" cards show name, added datetime, unit price, total purchase cost, remaining `currentQty / initialQty` with a colored progress bar, and a "إنقاص بمقدار 1" button.
- Status thresholds (`inventoryStatus` helper): `ratio ≤ 0.5` → yellow warning banner "وصلت كمية «X» إلى النصف"; `ratio ≤ 0.25` → red banner "كمية «X» وصلت إلى الربع — يحتاج زيادة المنتج".
- When `currentQty` hits 0 the item auto-moves to "المنتجات المفروغ منها" section (read-only badge "منتهٍ" + red banner "تم انتهاء العدد — يرجى شراء عدد أكثر من المنتج"), with no decrement/edit controls.

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

**Optional order notes** — `Order.notes?: string` (≤300 chars). Mobile cart shows a "ملاحظات إضافية (اختياري)" multiline input (bean type, extra heat, customizations). Admin renders notes in: orders tab card (highlighted gold-bordered block), printed-orders archive (truncated single line), and the printable invoice HTML (HTML-escaped, between items table and totals).

## Broadcast notifications (super-admin → all game users)

Super-admin can push system messages to every Copointo player from the **Copointo Hub** page header ("إشعار للمستخدمين" button, Megaphone icon).

**Backend** — `Broadcast { id, message (≤500 chars), createdAt }` array in `store.ts`. Routes: `POST/GET/DELETE /api/admin/broadcasts` (admin), `GET /api/broadcasts?since=<ISO>` (public — mobile poll, since-filter for delta).

**Admin UI (`CopointoHubPage.tsx`)** — modal with textarea (500-char counter, "سيُرسل من: Copointo" label), send button, success chip, and a scrollable history below with delete-from-log buttons.

**Mobile** — `notifications.tsx` fetches `/api/broadcasts` on mount + focus, renders a gold-bordered card per broadcast with 📣 badge, "Copointo • رسمي" sender, relative time (الآن / قبل N د/س/يوم), and the message body. On open it writes the newest `createdAt` to AsyncStorage key `copointo_broadcast_last_seen_v1`. Game tab bell badge (`game.tsx`) polls broadcasts every 30s and on focus, adding `unread = broadcasts.filter(b => b.createdAt > lastSeen).length` to the existing friend-request count so users see the badge clear after viewing.

## Reels viewer UI (mobile)

`(tabs)/videos.tsx` TikTok-style layout:
- **Right rail (top→bottom)**: Like (Ionicons heart / heart-outline; fully filled red `#FF1744` when liked, optimistic toggle persists), Comments (count), then two stacked CTA pills under comments — gold filled "اطلب" (Order) and gold-bordered transparent "الموقع" (Location). 50px circles with tiny 9pt label.
- **Bottom-left**: small dark-translucent views chip (eye icon + count), much smaller than other actions.
- **Comments sheet**: `rgba(0,0,0,0.55)` background + `backdropFilter: blur(18px)` (web) so the reel shows through. New comments are inserted at the **top** of the list immediately after submit (optimistic), reel comment-count bumps too.
- All numbers have a subtle black text-shadow so they remain legible over any frame.

## Reel video streaming

Reels are stored on the server as base64 data URLs but **never** sent that way to clients. The list endpoints (`GET /api/reels` and `GET /api/cafe/:cafeId/reels`) replace `videoUrl` with a path to `GET /api/reels/:rid/video`, which decodes the base64 once and streams the binary with the correct `Content-Type`, `Content-Length`, and full **HTTP Range** support (206 Partial Content). This lets `<video>` start playing immediately instead of waiting for a multi-megabyte data URL to fully buffer (which manifested as a black screen).

Admin video preview thumbnail in the upload form is `w-28` (small) so the form stays compact.

## Reel upload — any source quality, capped at 1080p

Cafes can upload videos of **any resolution and any size** (no MB cap). The admin form (`CafeDashboardPage.tsx ReelsTab`) shows the source `WIDTH×HEIGHT · SIZE MB` immediately after pick.

**Client-side downscale to 1080p** — when user clicks "نشر الريل":
1. Phase `processing`: if source height > 1080, the file is played through a hidden `<video>` element and re-encoded via canvas `captureStream(30)` + `MediaRecorder` (vp9/vp8/webm with audio track copied from the source) at the largest 1080p-bound size (height=1080, width preserved & rounded to even). Files already ≤1080p pass through untouched.
2. Phase `uploading`: encoded blob → data URL → XHR POST `/api/cafe/:cafeId/reels` with `xhr.upload.onprogress` driving a real percentage bar.

UI shows a single gold progress bar with the current phase label ("جارٍ معالجة الفيديو وتقليص الجودة…" / "جارٍ رفع الفيديو…") and a percent counter. Server JSON limit raised to 300mb in `app.ts` to accommodate longer 1080p reels.

## Auto-derived reel links

When a cafe publishes a reel, both `orderLink` and `locationUrl` are filled automatically by the server (`POST /api/cafe/:cafeId/reels`):
- `orderLink` defaults to `copointo://cafe/<cafeId>` (deep-link to the cafe page in the app).
- `locationUrl` defaults to `https://www.google.com/maps/search/?api=1&query=<lat>,<lng>` when the cafe has coordinates, otherwise to a maps search of the cafe's address. Cafe creation already geocodes addresses, so coords are usually present.

The admin "Add Reel" form in `CafeDashboardPage.tsx ReelsTab` no longer asks for these — it shows a small gold info card stating both will be added automatically. Only video file + description are required.

## Copointo Reels

Vertical short-video feature with Instagram/TikTok-style reels.

**Backend (`api-server`)** — types `Reel`, `ReelLike`, `ReelComment`, `ReelView` in `store.ts`. JSON body limit raised to 60mb so admin can POST videos as data URLs.

Public endpoints (mobile):
- `GET  /api/reels?userId=…` — engagement-ranked feed (likes×3 + comments×5 + views×0.05 + recency boost). Returns `likedByMe` per reel.
- `POST /api/reels/:rid/like`     — toggle like (idempotent per `userId`).
- `GET  /api/reels/:rid/comments` — list comments (chronological).
- `POST /api/reels/:rid/comments` — add comment.
- `POST /api/reels/:rid/view`     — increment view (deduped per `userId`).

Admin endpoints (per cafe, mounted under `/api/cafe/:cafeId`):
- `GET    /reels`                          — list cafe's reels (with like/comment counts).
- `POST   /reels`                          — create (videoUrl/description/orderLink/locationUrl).
- `DELETE /reels/:rid`                     — delete reel + cascade likes/comments.
- `GET    /reels/:rid/comments`            — list comments newest-first.
- `DELETE /reels/:rid/comments/:cid`       — moderate (delete) a comment.
- `GET    /reels-notifications?since=…`    — feed of new likes & comments on this cafe's reels.

**Admin UI (`CafeDashboardPage.tsx`)** — new `"reels"` tab "كوبوينتو ريلز" with `<Video>` icon. `ReelsTab` component: file upload (≤50MB, video/* only) → base64 → POST; recent likes/comments panel; per-reel grid with view/like/comment counts; comments modal with delete-comment moderation. Wired into `useTabNotifications` so the cafe gets bell + badge whenever a customer likes or comments.

**Mobile (`(tabs)/videos.tsx`)** — refactored from mocks to live `/api/reels` feed. Fullscreen vertical FlatList paged by `VIDEO_HEIGHT`; right rail with heart/comments/views; bottom CTAs "اطلب الآن" (deep-links to `/cafe/:id`) and "موقع الكوفي" (opens `Linking`). Comments modal with optimistic-add. Web uses native `<video>` (autoplay/muted/loop); native shows a placeholder (full Expo video integration deferred — user is testing in web preview). Auto-fires `/view` on first activation per session per reel.

## Free coffee redemption (loyalty reward)

Every 7 drinks a customer orders, the server awards them one **free coffee** (`awardMilestoneCoffees` in `routes/cafe-dashboard.ts`, fired from `awardOrderProgress` on the first transition out of `pending`). Each free coffee is **stamped with the cafe it was earned at** (`FreeCoffee.earnedAtCafeId` + `earnedAtCafeName` in `store.ts`) and is **strictly redeemable ONLY at that exact cafe** (`fc.earnedAtCafeId !== cafeId` rejects with a localized error naming the originating cafe — e.g. `هذا الكوفي المجاني يُستخدَم فقط في "كوفي X"`). There is no fallback: legacy free-coffees with a null `earnedAtCafeId` are not redeemable anywhere; the mobile cart filters them out and the notifications screen flags the originating cafe in bold. The manual "كوفي مجاني" button has been removed from the admin dashboard — redemption is now driven entirely by the customer in the mobile cart.

**Server (`POST /api/cafe/:cafeId/orders`)** is implemented as a **two-phase commit**: Phase 1 validates everything (stock availability, discount-code validity, free-coffee redemptions) without mutating any state; Phase 2 commits all mutations together (stock decrements, `discountCode.usedCount++`, free-coffee `redeemedAt`/`redeemedAtCafeId`/`redeemedOrderId`, then `orders.push`). This guarantees a 4xx return at any validation step leaves zero orphan side-effects (verified e2e: invalid free-coffee code returns 404 with stockQty and usedCount unchanged). The endpoint accepts an optional `freeCoffeeRedemptions: [{ code, itemName, itemPrice }]` array. Each entry is validated (code exists, owned by `customerPhone`, unredeemed, `earnedAtCafeId === cafeId`, item present in the order, price ≤ 2 OMR, category not `طعام`/`حلى`, no duplicate codes in the same request). The line prices are subtracted from `total` (floored at 0), and the order persists `freeCoffeeRedemptions[]` + `freeCoffeeDiscount` for the admin's records. Multi-redemption is allowed (one code per drink-cup, up to the number of qualifying cups in the order). Item `category` travels through the cart payload (`CartItem.category` in `AppContext.tsx`, populated from `ProductCard`/`order.tsx`) so the server's eligibility filter works.

**Mobile cart (`app/cart.tsx`)** — on the customer-info step, when the signed-in user has any unredeemed free coffees earned at the current cafe, a gold "🎁 لديك N كوفي مجاني — استخدمه الآن" button appears between the order summary and the submit button. It opens a bottom-sheet picker that lists every qualifying drink-cup in the cart (per-cup expansion of `cart` items where `price ≤ 2` and `category ≠ طعام/حلى`); the user toggles up to N cups (where N = number of held free coffees). The summary line and footer total update live (`freeCoffeeDiscount` subtracted from `finalTotal`, with `Math.max(0, …)` floor). Submit pairs picks with held codes (oldest-first) and sends them in `freeCoffeeRedemptions`.

**Mobile notifications (`app/notifications.tsx`)** — fetches `/api/free-coffees?phone=` and shows a gold-bordered card per unredeemed coffee with title "حصلت على كوفي مجاني!", relative time + level, the originating cafe name, the rules block (مشروبات فقط، ≤ 2 ر.ع.، استخدام مرة واحدة), and the 6-character code on a gold pill. AsyncStorage key `copointo_free_coffee_last_seen_v1` mirrors the broadcast-pattern for bell-badge clearing. The game-tab bell badge (`app/(tabs)/game.tsx`) sums `incomingRequests + unreadBroadcasts + unreadFreeCoffees`, polling `/free-coffees?phone=` every 30s and on screen focus; the badge clears as soon as the user opens `/notifications` (which writes the last-seen timestamp).

**Admin (`CafeDashboardPage.tsx`)** — each order card now renders a gold-bordered "🎁 كوفي مجاني مُستبدل" block listing every redemption (item name + level + line price) and the total saved. The legacy `freeCoffeeCode` badge for older single-code orders still renders for backward compatibility.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/copointo run dev` — run Expo app

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
