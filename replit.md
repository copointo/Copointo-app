# Overview

The Copointo project is a pnpm workspace monorepo utilizing TypeScript, designed to be a full-featured coffee ordering platform for Oman. It includes a mobile application for customers, an administrative dashboard for cafe owners, and a robust API backend.

**Key Capabilities:**

*   **Mobile Ordering & Booking:** Customers can browse cafes, view menus, place orders (dine-in or car), and book tables.
*   **AI Chat (Copointo Bot):** An in-app AI assistant provides information, guides ordering, and assists with table bookings.
*   **Loyalty & Gamification:** A game with levels, ranks, and free coffee rewards drives customer engagement.
*   **Real-time Communication:** Features like user-to-user messaging, user-to-cafe messaging, and broadcast notifications.
*   **Cafe Management:** Admin dashboard allows cafe owners to manage menus, orders, tables, inventory, discount codes, and access detailed analytics.
*   **Dynamic Content:** TikTok-style video reels for cafes, with streamlined upload and streaming.
*   **Location-based Services:** Map view of nearby cafes with location permissions and interactive pins.

The project aims to provide a comprehensive, engaging, and efficient platform for coffee lovers and cafe owners in Oman.

# User Preferences

I want iterative development. Ask before making major changes.

# System Architecture

The project is structured as a pnpm workspace monorepo.

**Technology Stack:**

*   **Node.js:** v24
*   **Package Manager:** pnpm
*   **TypeScript:** v5.9
*   **API Framework:** Express 5
*   **Database:** PostgreSQL with Drizzle ORM
*   **Validation:** Zod (`zod/v4`), `drizzle-zod`
*   **API Codegen:** Orval (from OpenAPI spec)
*   **Build Tool:** esbuild (CJS bundle)
*   **Mobile Framework:** Expo (React Native) for `copointo` mobile app.

**UI/UX Decisions:**

*   **Brand Logo:** Copointo droplet logo lives at `artifacts/admin/src/assets/copointo-logo.png` (Vite import) and `artifacts/copointo/assets/images/copointo-logo.png` (Expo `require()`). Replaces the legacy `☕` emoji and `Coffee` lucide icon as the brand mark in: Admin → `App.tsx` (home + page header), `Sidebar.tsx`, `LoginPage.tsx`; Mobile → `AuthGate.tsx` (splash brand), `AuthModal.tsx` (login/register header). To use it elsewhere in admin: `import logoUrl from "@/assets/copointo-logo.png";` then `<img src={logoUrl} className="object-contain" />`. In Expo: `<Image source={require("../assets/images/copointo-logo.png")} style={{ resizeMode: "contain" }} />`.
*   **Color Scheme:** Pure-black background with an amber-glow (#E8B86D) theme throughout the mobile application. Specific components like the Cart, Cafe detail, Order, Conversation, and Profile screens maintain this theme with specific dark background and border colors.
*   **Avatar & Progress Indicators:** User profiles feature a double glowing ring around the avatar for level display. Game screens use diamond-shaped tiles with amber borders.
*   **RTL Support:** Invoices and various UI elements are designed for Right-to-Left (RTL) Arabic text.
*   **i18n (AR/EN):** Full Arabic/English translation system in `artifacts/copointo/i18n/translations.ts` (flat-key dict, `{placeholder}` interpolation) wired through `context/LanguageContext.tsx` (`LanguageProvider` mounted in `_layout.tsx` between QueryClientProvider and AppProvider; persists choice in AsyncStorage key `copointo_lang_v1`). Components use the `useT()` hook → `{t, lang, setLang, toggle, dir, isAr, isEn, hydrated}`. A globe-icon language toggle button sits at the right of the home-screen header (shows opposite-language label "EN"/"ع"). Translation status: foundation complete + translated screens = home (index.tsx), my-cafes.tsx, AuthGate.tsx, AuthModal.tsx (login/register flow), messages.tsx ("New group" button). Remaining (queued for next sessions): profile.tsx, game.tsx, cart.tsx, videos.tsx, cafe/[id]*, communities*, conversation, leaderboard, notifications, add-friend, cafes-map, order-timer, plus shared components (CafeSheet, ProductCard, RankBadge). Tab labels are already English so no translation needed.
*   **Mobile Layouts:** TikTok-style vertical video feed for reels, with a dedicated right rail for actions and a bottom-left view counter. Comments sheets have a semi-transparent blurred background.
*   **Admin Dashboard:** Features a gold crown button for manager analytics, a tab-based interface for various management functions (Invoices, Expenses, Templates, Inventory, Reels, Discount Codes, Barcode/QR codes for the dashboard and cafe page).

**Technical Implementations & Features:**

*   **Data Persistence:** AsyncStorage for mobile app local persistence.
*   **AI Chatbot:** Data-aware assistant for cafes, integrating menu, table, and chat info. Supports guided ordering and booking flows. Conversation persists per cafe in AsyncStorage (`copointo_chat_state_v1_<cafeId>`) and is restored on screen mount; a header trash button clears the saved chat after confirmation. Validation errors keep the user on the same step and reply with the prefix "🙏 الرجاء إعادة الكتابة" so the questionnaire never gets stuck. Free-mode questions with no matching keyword fall back to "🙏 لا أعلم ماذا تريد بالضبط..." with quick chips to redirect to ordering or contacting the cashier. Cross-cafe persistence guard: a `hydratedForCafeIdRef` ensures the persist effect never writes the previous cafe's state into a newly-mounted cafe's storage key.
*   **Table Booking:** Mandatory hourly pricing, approval workflows for cafe admins, time slot management (available/blocked times), and invoice generation upon confirmation.
*   **Order Management:** Real-time menu fetching, in-app cart wizard, order submission with status tracking, and customer loyalty point awards.
*   **Inventory Tracking:** Admin dashboard module for tracking stock levels (coffee bags, equipment), with automatic status alerts (yellow/red for low stock) and item depletion management.
*   **Discount Codes:** Cafe-specific digit-only promo codes with percentage discounts and expiry dates, integrated into the mobile cart and validated server-side.
*   **Reels Management:** Admin can upload videos of any quality (client-side downscaling to 1080p), with auto-derived order and location links. Backend supports HTTP Range for efficient video streaming.
*   **Loyalty System:** Free coffee rewards earned every 7 drinks, redeemable only at the cafe where they were earned, implemented with a two-phase commit for atomic transactions.
*   **Auth System:** Local AsyncStorage-based register/login for mobile. Server-side `gameUsername` uniqueness enforcement and user mirroring for super-admin visibility. Global auth gate ensures all app entry points require login.
*   **Friendships & Messaging:** Explicit acceptance for friend requests. User-to-user and user-to-group chat functionalities with cross-device mock delivery.
*   **Location Map:** Cross-platform Leaflet HTML map rendered via iframe/webview showing cafe locations, with user location and interactive pins.
*   **Cafe Ratings:** 1-5 star optional rating system for cafes, impacting cafe sorting on the home screen.
*   **Manager Analytics:** Password-protected full-page analytics view in the admin dashboard showing revenue, top products, order types, busiest times, booking status, and player rankings.
*   **Invoice Templates & Expenses:** Customizable invoice templates for orders, expenses, daily, monthly, and yearly summaries. Comprehensive expense tracking module with printing capabilities.
*   **Broadcast Notifications:** Super-admin can push system messages to all game users, displayed in the mobile notifications screen and indicated by a bell badge.
*   **Barcode Tab (Admin):** New "الباركود" tab in `CafeDashboardPage.tsx` shows two scannable QR codes built from `window.location.origin`: a gold one for the customer-facing cafe page (`/cafe/:id`, printable on tables) and a blue one for the cafe owner's dashboard (`/admin/cafe/:id`, staff-only). Each card supports copy-link, open-link, and per-card or combined A4 print (uses `qrcode.react` on-screen and `api.qrserver.com` images for the print sheet).
*   **Edit Cafe (Super-Admin):** Added `PATCH /api/admin/cafes/:id` endpoint and a Pencil edit button per row in `CafesPage.tsx`. Reuses the existing 3-step add-wizard modal in "edit" mode (title flips to "تعديل الكوفي", submit flips to "حفظ التعديلات"). Empty `managerPassword` keeps the existing one; `lat`/`lng` are intentionally cleared on edit so the server re-geocodes when the address changes (unless a Google Maps URL with coordinates is pasted).
*   **Direct In-Cafe Order (Cafe Dashboard):** New "اطلب مباشر" tab in `CafeDashboardPage.tsx` lets staff place a walk-in order on behalf of a customer. Captures only customer name (no phone), ships `source: "direct"` to `POST /api/cafe/:cafeId/orders`. The order flows through the normal pending → preparing → ready → done pipeline and shows up in "طلبات القهوة" with a "مباشر" badge and the label "☕ طلب مباشر من الكوفي" (replacing phone+location). The printed invoice shows "طلب مباشر من الكوفي / Direct in-cafe order" as a banner instead of phone/location. `awardOrderProgress()` early-returns when `source === "direct"`, so loyalty/game progress is intentionally NOT credited even if the customer phone happens to match a real user.
*   **Hard-Delete vs Ban (Super-Admin Users):** `DELETE /api/admin/users/:id` in `routes/admin.ts` is now a full purge — it removes the user from `users`, frees their `gameUsername` from `usernameRegistry`, drops both directions of `friendRequests`/`friendships`, deletes all `chatMessages` they sent or any 1:1 friend conversation containing their id (and strips them from `seenBy` of any retained group messages), removes their `reelLikes`/`reelComments`/`reelViews` (matched by both `userId` and phone since reel engagement keys vary), drops pending `coinGifts` and submitted `cafeRatings`, deletes all `freeCoffees` owned by their phone (loyalty resets), removes their `reports` (matched by `reporterUserId` or normalized phone), anonymizes `cafeViews` (clears `userId`+`userPhone`), and anonymizes `orders`+`bookings` (sets `customerName="مستخدم محذوف"`, clears `customerPhone` and `userId`) so cafe revenue history is preserved but no PII remains. Phone normalization (`String(p).replace(/\D+/g, "")`) is used everywhere phones are compared so country-code/format mismatches don't leak data. After delete, the same phone can register fresh as a brand-new account. `PATCH /api/admin/users/:id/ban` is unchanged — it sets `banned=true` + `banReason` + `bannedAt` while keeping every record intact (the mobile app's full-screen ban gate just blocks the account from being used). The two operations are intentionally distinct: ban = soft-block, delete = hard purge.
*   **Per-Product Discounts & Buy-X-Get-Y Promos in Order Flow:** Menu items in `CafeDashboardPage.tsx` already supported `originalPrice` (in-product discount) and `promoBuyQty`/`promoGetQty` (bundle freebie) via `MenuForm.promoMode`. These promos now flow through the entire customer order experience: snapshotted onto each `CartItem` (`originalPrice`, `promoBuyQty`, `promoGetQty` fields in `AppContext.tsx`) when added in `order.tsx`/`chat.tsx`, displayed in `cart.tsx` as a strikethrough old-price + green `-X%` chip and a gold "🎁 +N مجاني • الإجمالي N+M كوب" line per row, plus aggregate "وفّرت من تخفيضات الكوفي" and "🎁 مشروبات مجانية" rows in the order-summary box. Chat bot summary (`currentOrderSummary` in `chat.tsx`) shows old-price strikethrough and bonus suffix per line, plus aggregate savings and bonus footer lines. Bonus quantity is derived everywhere as `floor(qty / promoBuyQty) * promoGetQty` — never stored as the source of truth, only computed for display and snapshotted into the order payload as `bonusQty`. Server `Order.items` in `store.ts` accepts `originalPrice`, `promoBuyQty`, `promoGetQty`, `bonusQty` (all optional) and persists them via the existing `...body` spread in `POST /orders`. Admin `printOrderInvoice` renders strikethrough old-line-total above the new line total, a gold "🎁 +N مجاني (عرض اشترِ X احصل على Y) — الإجمالي N+M كوب" note under the item name, and a `(+N)` qty annotation. Loyalty (`awardOrderProgress`) is unaffected — bonus drinks are NOT counted toward the customer's drink milestone (intentional: the 7-drink free-coffee reward should only count what the customer paid for).
*   **Bean Type & Size Selection:** Menu items in `CafeDashboardPage.tsx` (`MenuForm`) can define optional `beans: string[]` and `sizes: { label, extraPrice }[]`, each with its own `beansRequired` / `sizesRequired` boolean toggle ("اختيار البن/الحجم إلزامي عند الطلب"). Server `MenuItem` in `store.ts` carries both required flags; `normalizeVariants` in `cafe-dashboard.ts` coerces them. Mobile `order.tsx` opens a chip-based variant modal when an item has beans/sizes — required flags block confirm; cart line id becomes composite `${menuItemId}::${bean}::${sizeLabel}` so two same drinks with different beans stay as separate cart lines (the minus button is hidden for variant items, qty in the menu list sums all variants of the same `menuItemId`). Chat bot in `chat.tsx` adds `order_pick_bean` and `order_pick_size` steps via `proceedAfterItemPick(item, current?)` which branches bean → size → qty using only the configured steps; required validation keeps the user on-step with a "🙏 الرجاء إعادة الكتابة" retry. `CartItem` in `AppContext.tsx` carries `menuItemId`, `selectedBean`, `selectedSize`, `sizeExtraPrice`. `cart.tsx` displays variant bits under each row and forwards them in the order payload; chat `submitOrder` does the same. Server `POST /:cafeId/orders` persists variant fields automatically via `...body` spread (Order.items already typed with selectedBean/selectedSize/sizeExtraPrice). Admin invoice (`printOrderInvoice` in `CafeDashboardPage.tsx`) renders a small "☕ bean • 📏 size" line under the item name so the kitchen can distinguish variants. Loyalty (`awardOrderProgress`) is unaffected — it recomputes drinks from `qty/category`, not item ids.
*   **Reels Two-Step Wizard (Cafe Dashboard):** The "كوبوينتو ريلز" upload form in `CafeDashboardPage.tsx` is now a 2-step wizard: step 1 picks the file + writes the description, step 2 shows a full-size preview (max 480px tall) with the description and a clear publish button. Re-encoding (>1080p downscale) now falls back to the original file if the in-browser MediaRecorder fails, so uploads never get stuck in processing.

# External Dependencies

*   **OpenStreetMap:** Used for the cafes-on-the-map feature.
*   **Google Maps API:** Used for `locationUrl` generation based on cafe coordinates.
*   **Expo:** Core framework for the React Native mobile application.
*   **react-native-webview:** Used for rendering the Leaflet map within the native mobile app.
*   **Ionicons:** Icon library for mobile UI.