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
- **Data**: Mock data in `data/mockData.ts` (CAFES, PRODUCTS, VIDEOS, RANKS). `MESSAGES` and `CHAT_HISTORY` are intentionally empty — all conversations are derived from real friend connections.
- **Auth**: Local AsyncStorage-based register/login. `User` has optional `avatar?: string` and `gender?: "male" | "female"`. The `setUser()` mutator in `AppContext` keeps both `currentUser` and the matching entry in `registeredUsers` in sync (state + AsyncStorage), so profile edits (avatar, etc.) propagate to the leaderboard, game header, friends list, and competitor profile, and persist across logout/login.
- **Friend requests** (in `AppContext`): friendships now require explicit acceptance. Per-user keys `friend_requests_in:<uid>` and `friend_requests_out:<uid>` plus `friends:<uid>` are written to AsyncStorage. `sendFriendRequest`, `acceptFriendRequest`, `declineFriendRequest`, `cancelFriendRequest`, and `refreshFriendData` are exposed via `useApp()`. Cross-user mock sync is achieved by writing directly to the other user's storage keys (since the device is shared between test users). Leaderboard shows three button states next to each row: amber "+" (no relationship), dashed amber "⏳ معلّق" (request pending — tap to cancel), green "✓" (other user requested me — tap to accept). Notifications screen lists all incoming requests with "قبول" / "رفض" actions.
- **Messaging** (in `MessagesContext`): conversation list is derived from `useApp().friends` × `registeredUsers`. Conversation IDs use the format `friend_<friendId>`. Storage keys are per-user (`copointo_chats_v2:<uid>` and `copointo_unread_v2:<uid>`) so each test user keeps an isolated inbox. When a user sends a message (`fromMe=true`), `appendMsg` mirrors a copy with `fromMe=false` into the recipient's storage to mock cross-device delivery; the messages and conversations tabs call `refreshChats` on focus to pick up incoming mirrored messages. Brand-new conversations show the placeholder "صديق جديد — ابدأ المحادثة 👋" until the first real message lands. Sent bubbles use amber background (#E8B86D) with black text and dark ticks.
- **Groups** (chat groups, also in `MessagesContext`): user-created group chats (`Group` interface in `mockData.ts`) with name + optional avatar + selected friends. FAB on the messages tab opens `app/create-group.tsx`. Conversation IDs for groups use `group_<id>`; tapping a group opens `conversation.tsx?type=group&id=...` which shows sender labels/avatars on incoming messages. Tapping the conversation header opens `app/group-info.tsx` for managing members.
- **Communities** (in `CommunityContext`): clan-style groups for the Game tab. A `Community` (in `mockData.ts`) has 2-50 members with a score equal to the sum of all members' `totalOrders`. Per-user storage keys: `copointo_communities_v1:<uid>` and `copointo_community_invites_v1:<uid>`. Cross-user mock: writes directly to other members' AsyncStorage (mirroring the `MessagesContext` pattern). Joining requires accepting an invite — only the creator can invite at creation time, and (later) any member can be invited via `inviteToCommunity`. If the creator leaves, the oldest remaining member is promoted. Screens: `app/communities.tsx` (tabs: مجتمعاتي + الترتيب — sorted by score), `app/create-community.tsx` (name + avatar + friends), `app/community-info.tsx` (stats, members, edit name/avatar by creator, kick by creator, leave), `app/community-invites.tsx` (accept/decline). Game tab gets a third small FAB (users icon, between user-plus and the purple Leaderboard) with a red badge showing pending invite count.

## Manager Analytics (Admin Dashboard)

The cafe dashboard (`artifacts/admin/src/pages/CafeDashboardPage.tsx`) has a special **gold crown button** in the tab row labeled "إحصائيات المدير". On click it opens a password modal — the password is the `managerPassword` set when the cafe was registered (verified server-side via `POST /api/cafe/:id/auth`). Once unlocked, it shows a full analytics view powered by `POST /api/cafe/:id/advanced-stats` (also password-protected): daily/monthly/yearly revenue (area chart with period switcher), top products & categories (pie + ranked list), order type pie (dine-in vs car), order source pie (direct vs chat), busiest weekday bar, booking status pie, visit→order conversion stats, complete invoice table, and a players ranking table that joins each customer's phone with their global Oman rank (sorted by `totalOrders`). Cafe-detail page views are tracked from the mobile app via `POST /api/cafe/:id/track-view` (called on mount in `artifacts/copointo/app/cafe/[id].tsx`). View records, plus a new `source: "direct"|"chat"` field on `Order`, live in the in-memory store (`artifacts/api-server/src/store.ts`).

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/copointo run dev` — run Expo app

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
