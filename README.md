# פורטל לקוחות — Client Portal

A client portal for the accounting-firm system. A client enters their **ח.פ / ע.מ**,
views their intake status and open tasks — pulled **live** from the Monday.com board —
and can confirm receipt of documents with a single button that writes back to the board.

Built with Next.js (App Router) + TypeScript, deployed on Vercel.

---

## Features

- **Live status lookup** — enter a ח.פ / ע.מ and see the client's intake status and
  all open tasks, filtered from the Monday board in real time.
- **Document receipt confirmation** — the "אישרתי קבלת מסמכים" button on the client
  card updates the intake-status column on Monday to "התקבלו מסמכים" without a page
  reload, and reflects the new status immediately in the UI.

---

## Architecture — two deliberate decisions

**1. The Monday API token is server-side only.**
All Monday calls happen inside server route handlers (`app/api/client/route.ts` and
`app/api/confirm/route.ts`). The token is read from `process.env.MONDAY_TOKEN` and is
**never** included in any response, so the browser never sees it. The page
(`app/page.tsx`) only ever calls our own `/api/client` and `/api/confirm` endpoints —
it has no knowledge of Monday or the token. This is the correct pattern for any
third-party API key in a web app.

**2. No authentication — by design, for demo scope.**
Anyone who knows a ח.פ can view that client's status. Real client data would require
authentication (magic-link email, client login, or a per-client access token). That is
intentionally out of scope for this exercise and is the first thing I'd add for production.

---

## How it works

### Read path — GET /api/client

```
Browser ──GET /api/client?hp=512345678──►  Next.js route handler (server)
                                              │  reads MONDAY_TOKEN (env)
                                              ▼
                                           Monday GraphQL API
   ┌──────────────────────────────────────────────────────────────┐
   │ 1. items_page_by_column_values → find client by ח.פ column     │
   │    returns: id, name, intake status, linked task IDs           │
   │ 2. items(ids: […]) → fetch those tasks, columns labelled       │
   │    by title; filter out status = "הוגש" (keep only open)       │
   └──────────────────────────────────────────────────────────────┘
                                              │
Browser ◄──── clean JSON (client + openTasks) ─┘
```

### Write path — POST /api/confirm

```
Browser ──POST /api/confirm { itemId }──►  Next.js route handler (server)
                                              │  reads MONDAY_TOKEN (env)
                                              ▼
                                           Monday GraphQL API
                              change_simple_column_value(
                                board_id, item_id,
                                column_id: "color_mm4yypb4",
                                value: "התקבלו מסמכים"
                              )
                                              │
Browser ◄──── { ok: true, status: "התקבלו מסמכים" } ─┘
```

The page updates the status pill and replaces the button with a confirmation line —
no full reload needed.

Task columns are matched **by title** (`סטטוס`, `דדליין`, `סוג משימה`), so the tasks-board
column IDs don't need to be hardcoded.

---


## Files

| File | Role |
|---|---|
| `app/page.tsx` | The single page — ח.פ input, status card, tasks list, confirm button, loading/error states |
| `app/api/client/route.ts` | Server route — looks up client by ח.פ; Monday token stays here |
| `app/api/confirm/route.ts` | Server route — writes "התקבלו מסמכים" back to the board via `change_simple_column_value`; token stays here |
| `app/globals.css` | Styling (ledger-inspired palette, RTL) |
| `app/layout.tsx` | RTL Hebrew document shell |

---

## Known limitations / next steps

- **No auth** (see above) — the top production priority.
- **No caching / rate-limit handling** — fine at demo scale; production would cache and
  back off against Monday's rate limits.
