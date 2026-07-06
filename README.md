# פורטל לקוחות — Client Portal

A minimal, read-only client portal for the accounting-firm system. A client enters
their **ח.פ / ע.מ**, and the page shows their intake status and open tasks — pulled
**live** from the Monday.com board.

Built with Next.js (App Router) + TypeScript, deployed on Vercel.

---

## Architecture — two deliberate decisions

**1. The Monday API token is server-side only.**
All Monday calls happen inside `app/api/client/route.ts`, a server route handler. The
token is read from `process.env.MONDAY_TOKEN` and is **never** included in any response,
so the browser never sees it. The page (`app/page.tsx`) only ever calls our own
`/api/client` endpoint — it has no knowledge of Monday or the token. This is the correct
pattern for any third-party API key in a web app.

**2. No authentication — by design, for demo scope.**
Anyone who knows a ח.פ can view that client's status. Real client data would require
authentication (magic-link email, client login, or a per-client access token). That is
intentionally out of scope for this exercise and is the first thing I'd add for production.

---

## How it works

```
Browser ──GET /api/client?hp=512345678──►  Next.js route handler (server)
                                              │  reads MONDAY_TOKEN (env)
                                              ▼
                                           Monday GraphQL API
   ┌──────────────────────────────────────────────────────────────┐
   │ 1. items_page_by_column_values → find client by ח.פ column     │
   │    returns: name, intake status, linked task IDs               │
   │ 2. items(ids: […]) → fetch those tasks, columns labelled       │
   │    by title; filter out status = "הוגש" (keep only open)       │
   └──────────────────────────────────────────────────────────────┘
                                              │
Browser ◄──── clean JSON (client + openTasks) ─┘
```

Task columns are matched **by title** (`סטטוס`, `דדליין`, `סוג משימה`), so the tasks-board
column IDs don't need to be hardcoded.

---

## Local setup

```bash
npm install
cp .env.local.example .env.local   # then fill in MONDAY_TOKEN
npm run dev                        # http://localhost:3000
```

`MONDAY_TOKEN` — from monday.com → avatar → Developers → My access tokens.
`CLIENTS_BOARD_ID` — defaults to `5099721289`; override via env if needed.

---

## Deploy to Vercel

1. Push this repo to GitHub.
2. On [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
3. Before deploying, add Environment Variables:
   - `MONDAY_TOKEN` = your token
   - `CLIENTS_BOARD_ID` = `5099721289`
4. Deploy. Vercel gives you a live URL.

> The token is set in Vercel's env settings, never committed to the repo.

---

## Files

| File | Role |
|---|---|
| `app/page.tsx` | The single page — ח.פ input, status card, tasks list, loading/error states |
| `app/api/client/route.ts` | Server route — Monday GraphQL, token stays here |
| `app/globals.css` | Styling (ledger-inspired palette, RTL) |
| `app/layout.tsx` | RTL Hebrew document shell |

---

## Known limitations / next steps

- **No auth** (see above) — the top production priority.
- **Read-only** — the assignment's bonus write-back button (client confirms document
  receipt → updates the board) is not included; it would be a `POST /api/confirm` route
  running a `change_simple_column_value` mutation.
- **No caching / rate-limit handling** — fine at demo scale; production would cache and
  back off against Monday's rate limits.
