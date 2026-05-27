# Arena 15 — Deploy & Multiplayer Setup

This project uses **Vercel** (Next.js hosting) + **Convex** (database + real-time websockets + auth).
Both have permanent free tiers; for hobby usage you should never hit limits.

## 1. First-time local setup

```powershell
npm install
npx convex dev
```

`npx convex dev` will:

1. Prompt you to log in to Convex (browser opens).
2. Ask you to create a new project — name it `arena-15`.
3. Generate `convex/_generated/` (types + API stubs the client imports).
4. Write `NEXT_PUBLIC_CONVEX_URL` into `.env.local`.
5. Start syncing every `convex/**/*.ts` change to your dev deployment.

Leave that terminal running. In a **second terminal**:

```powershell
npm run dev
```

Open http://localhost:3000. You'll be auto-assigned a guest handle.

### Testing multiplayer locally

Open the site in two different browsers (e.g. Chrome + Firefox, or one regular + one incognito window) so each gets its own session token. Create a room in one, copy the code into the other, both hit "Ready up", and the match starts.

## 2. Deploy

### Convex (production)

```powershell
npx convex deploy
```

This creates a separate **production** deployment. Note the URL it prints (`https://<name>.convex.cloud`); you'll paste it into Vercel below.

### Vercel

1. Push the repo to GitHub.
2. Go to https://vercel.com/new, import the GitHub repo.
3. Under "Environment Variables" set:

   - `NEXT_PUBLIC_CONVEX_URL` = the production URL from `npx convex deploy`

4. Click Deploy.

Future pushes to `main` auto-deploy. Convex schema/function changes need `npx convex deploy` from your machine (or via Convex GitHub integration — see Convex dashboard → Settings → Integrations).

## 3. Architecture notes

- **Server-authoritative scoring.** The Convex function `convex/games/timeout.ts` picks the round target, validates submissions against a wall-clock bound, and computes scores. Clients only send their measured elapsed time — they can't fake faster.
- **Anonymous-first auth.** Every visitor gets an auto-created guest user (`convex/users.ts → createGuest`). Sessions persist via a token in `localStorage`. Signing up promotes the guest record to a real account (preserving stats).
- **Adding a new game later** (the answer to "do I have to rebuild multiplayer every time?"):
  1. Create `convex/games/<gameId>.ts` exporting `initialMatchData`, `nextRoundData`, and `submit` — matching the contract in `convex/match.ts`.
  2. Add the new game to the `GAMES` map at the top of `convex/match.ts`.
  3. Build the React component in `components/games/<GameId>Game.tsx`.
  4. Add a render case in `app/play/room/[code]/game/page.tsx`.
  5. Add metadata to `lib/games.ts` and remove the `disabled` flag in `app/play/page.tsx`.

  Rooms, lobby, ready-up, scoring, and persistence are reused automatically.

## 4. Costs

- Convex free tier: 1M function calls + 0.5 GB storage / month. No card required.
- Vercel Hobby: 100 GB bandwidth + 100k function invocations / month. No card required.
- Neither service auto-charges. If you exceed the free tier you get throttled or asked to upgrade — no surprise bills.
