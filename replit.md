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
  - User profile with level/rank progress
  - Shopping cart with order management
- **State**: AsyncStorage for all persistence (no backend needed for first build)
- **Colors**: Warm espresso/amber palette with dark mode support
- **Data**: Mock data in `data/mockData.ts` (CAFES, PRODUCTS, VIDEOS, MESSAGES, RANKS)
- **Auth**: Local AsyncStorage-based register/login. `User` has optional `avatar?: string` and `gender?: "male" | "female"`. The `setUser()` mutator in `AppContext` keeps both `currentUser` and the matching entry in `registeredUsers` in sync (state + AsyncStorage), so profile edits (avatar, etc.) propagate to the leaderboard, game header, friends list, and competitor profile, and persist across logout/login.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/copointo run dev` — run Expo app

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
