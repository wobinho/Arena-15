# Arena 15

A chaotic collection of 1v1 mini games, built with Next.js 15 + Tailwind. Dark cartoon-arcade aesthetic, fully responsive (mobile-first), with mock auth, matchmaking, room codes, and per-game leaderboards.

## Stack

- **Next.js 15** (App Router, RSC)
- **TypeScript** (strict)
- **Tailwind CSS v3** with custom cartoon theme tokens
- **Zustand** for client state (auth / room / toasts)
- Mock auth via `localStorage` (swap for real backend before launch)

## Getting started

```bash
npm install
npm run dev
```

App runs at [http://localhost:3000](http://localhost:3000).

## Routes

| Path                            | Description                                  |
|---------------------------------|----------------------------------------------|
| `/`                             | Landing page with game cards grid            |
| `/login`, `/signup`             | Auth pages (mock — stored in localStorage)   |
| `/play`                         | Matchmaking: quick match, create room, join  |
| `/play/room/[code]`             | Pre-game lobby with ready-up + countdown     |
| `/play/room/[code]/game`        | The actual match (Timeout / High-Low)        |
| `/games/[id]`                   | Per-game detail page with rules + top board  |
| `/leaderboard/[id]`             | Full leaderboard for a game (podium + table) |
| `/profile`                      | Player profile + per-game stats              |
| `/about`                        | Tech stack + deployment recommendations      |

## The games

- **Timeout** (`⏱️`) — Reflex/timing game. Hold the orb, release at exactly 5.000s. Best of 3 by lowest drift.
- **High-Low** (`🃏`) — Card prediction. Streak to score; bank or lose it.

Both are functional placeholders. Real-time opponent sync is stubbed.

## Recommended deployment

For a 1v1 game platform with rooms + matchmaking + leaderboards:

### Hosting: **Vercel** (recommended)
- Native Next.js host, zero-config deploys
- Edge functions for low-latency matchmaking
- Preview URLs per PR
- Generous free tier

```bash
# 1. Push this repo to GitHub
# 2. Import at https://vercel.com/new
# 3. Done — Next.js is auto-detected
```

### Auth + DB: **Supabase**
- Email + OAuth (GitHub, Discord, Google) out of the box
- Postgres for users, matches, and leaderboard scores
- Row-level security keeps it sane
- Realtime channels for room state sync

Swap `lib/auth-store.ts` to use `@supabase/supabase-js` client. The existing API surface (`signIn`, `signUp`, `signOut`, `user`) maps cleanly.

### Real-time game state: **PartyKit** (or Supabase Realtime)
- One `Room` per match — both clients connect via WebSocket
- Sub-100ms tick rate on Cloudflare Workers edge
- Authoritative server: validate inputs, resolve ties, emit results

```bash
npx partykit init
# Add a Room class that brokers `input` / `tick` / `result` messages.
```

### Alternative stacks

- **All-Vercel**: Vercel + Vercel Postgres + Vercel KV + Pusher Channels (or Ably) for real-time
- **All-Cloudflare**: Cloudflare Pages + D1 + Durable Objects (no PartyKit needed; DO is the same primitive)
- **Self-hosted**: Coolify/Railway + Postgres + a small Fly.io app for the WebSocket relay

## Replacing the mock layer

Before launch, three pieces need real implementations:

1. **`lib/auth-store.ts`** — currently stores credentials in localStorage. Replace `signIn`/`signUp` with calls to your auth provider (Supabase / Clerk / Auth.js).
2. **`lib/room-store.ts`** — Currently in-memory only. Replace `createRoom`/`joinRoom` with WebSocket-backed actions. Persist room code → host mapping in your backend so `joinRoom` actually resolves a real room.
3. **`lib/leaderboard.ts`** — Currently returns deterministic fake data. Replace with a server-side query (`SELECT … FROM match_results … ORDER BY score DESC LIMIT 100`).

## Project layout

```
app/                          # Routes (App Router)
  (auth)/login, /signup       # Auth pages
  games/[id]                  # Game detail
  leaderboard/[id]            # Leaderboards
  play/                       # Matchmaking + rooms
  profile/                    # Player profile
  about/                      # Stack + deploy guide
components/
  ui/                         # Button, Input, Sticker, Toast
  layout/                     # SiteHeader, SiteFooter
  games/                      # TimeoutGame, HighLowGame, GameShell
  auth/                       # AuthArtPanel
lib/
  games.ts                    # Game registry + accent tokens
  leaderboard.ts              # Mock leaderboard data
  auth-store.ts               # Zustand auth store (mock)
  room-store.ts               # Zustand room/lobby store
  toast-store.ts              # Toast notifications
  cn.ts                       # clsx wrapper
```

## Adding a new game

1. Add an entry to `GAMES` in `lib/games.ts` (id, name, accent, emoji, rules).
2. Create `components/games/<YourGame>.tsx` exporting a component that takes `{ room }`.
3. Add the render branch in `app/play/room/[code]/game/page.tsx`.

Routes for `/games/<id>` and `/leaderboard/<id>` are generated automatically from the registry.

## Responsive design

The app is mobile-first. Every page has been built and tested across:

- Mobile (375px) — hamburger menu, single-column layouts, full-width buttons
- Tablet (768px) — 2-column game grid, side-by-side player slots
- Desktop (1024px+) — 3-column grid, art panel on auth pages, marquee footer

The film-grain overlay, dot grid, and offset shadows scale cleanly across all sizes.

## Notes

- The `_themeColor` and viewport setup is configured per Next 15 conventions.
- Reduced-motion is respected globally via `prefers-reduced-motion`.
- All interactive components have visible focus rings (lemon outline).
