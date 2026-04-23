# Go-Next · Flow Document

> One place to understand how the Salon Queue app works end-to-end — for you, future agents, and anyone joining the project.
> Updated on every feature / bug-fix iteration.

**Last updated**: 2026-02 — iteration 2 (multi-outlet + analytics + public TV display)

---

## 1. What this app does

Go-Next is a calm, organic queue-management app for salons, clinics, spas, restaurants and similar service businesses. It replaces paper notebooks and chaotic WhatsApp groups at the front desk.

Three audiences use it:

| Audience              | What they do                                                                  | Where they are                 |
| --------------------- | ----------------------------------------------------------------------------- | ------------------------------ |
| Business owner        | Creates outlets, manages live queue, views analytics                          | `/login`, `/dashboard/…`       |
| Customer / guest      | Scans a QR, joins the queue, watches live position & ETA                      | `/join/:id`, `/ticket/:id`     |
| Lobby TV              | Displays the "Now Serving" board fullscreen on a screen in the salon          | `/display/:id`                 |

---

## 2. The three flows at a glance

### 2.1 Owner flow
1. Visit `/` → click **Create account**.
2. On `/register`, enter name, email, password, business name/type, address, **state + pincode (required)**. `total_chairs` is NOT asked — defaults to 1 and is editable in Settings.
3. After register → redirected to `/dashboard` → auto-redirected to `/dashboard/{first-outlet-id}`.
4. Dashboard header shows an **outlet switcher** and three tabs: **Live queue · Analytics · Settings**.
5. Use the header to add more outlets (Outlets page), switch between them, or go to Analytics / Settings for the selected outlet.

### 2.2 Customer flow
1. Scan the salon's QR code or open `/join/{businessId}`.
2. See live counts — waiting / serving / estimated wait.
3. Submit name + phone → receives a **token number** and is redirected to `/ticket/{ticketId}`.
4. On the ticket page, the position in the queue and ETA auto-refresh every 4s. When their turn comes, the page switches to "Please head to {Station} N".
5. A localStorage key `ticket-{businessId}` remembers the active ticket so returning to `/join/{businessId}` brings them back to their ticket directly.

### 2.3 Lobby TV flow
1. Owner copies the **Display link** from the dashboard sidebar (`/display/{businessId}`).
2. Opens it fullscreen on a lobby TV (no login needed).
3. Large token numbers per station + up to 6 upcoming guests + a live clock. Auto-refreshes every 3s.

---

## 3. Owner dashboard — how each control behaves

Dashboard page: `/dashboard/{businessId}`

| Control           | What it does                                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| Outlet switcher   | Switches the URL to the chosen outlet's dashboard/settings/analytics depending on the active tab               |
| Online toggle     | `PATCH /api/business/{id}` `{is_online}` — pausing hides the queue from new customer joins                     |
| Walk-in dialog    | `POST /api/business/{id}/queue/walk-in` — assigns the next token number                                        |
| Call next         | `POST /api/business/{id}/queue/call-next` — promotes the lowest-token waiting guest to `serving`, picks the first free chair, stamps `served_at` |
| Row "Start"       | Same effect as call-next but targets a specific ticket                                                         |
| Row "Done"        | Marks serving ticket as `completed`, stamps `finished_at`                                                      |
| Row "No-show" (icon) | Marks a waiting ticket as `no_show`, stamps `finished_at` (used in analytics)                               |
| Row "Cancel" (×)  | Marks as `cancelled`, stamps `finished_at`                                                                      |
| QR card           | Renders the `/join/{businessId}` URL as SVG; Copy link / Download SVG                                          |
| TV display card   | Quick links to open `/display/{businessId}` in a new tab + copy                                                |

Polling cadence on the dashboard: queue + stats every **3s**.

---

## 4. Data & status model

### 4.1 Collections
- `users` — `{id, email, password_hash, name, role, created_at}` (unique index on email)
- `businesses` — `{id, owner_user_id, business_name, business_type, address, city, state, pincode, total_chairs, token_limit, is_online, station_label, created_at}` — one owner → many businesses.
- `queue` — tickets. See next section.

### 4.2 Queue ticket lifecycle

```
                ┌────────────┐
 customer join /│  waiting   │─► no_show (owner: waiting→no_show)
 owner walk-in └─────┬──────┘
                     │ call-next / start
                     ▼
                ┌────────────┐
                │  serving   │─► cancelled (owner: ×)
                └─────┬──────┘
                      │ done
                      ▼
                ┌────────────┐
                │ completed  │
                └────────────┘
```

Timestamps: `created_at` (always), `served_at` (set on `serving`), `finished_at` (set on `completed | cancelled | no_show`).

### 4.3 Analytics math
- `completed`, `cancelled`, `no_show` totals over the selected window.
- `no_show_rate_pct = (cancelled + no_show) / (completed + cancelled + no_show) * 100`.
- `avg_service_minutes = mean(finished_at − served_at)` across completed tickets.
- Per-day series: one row per day in the window with `{completed, no_show}`.
- Busy-hour heatmap: `completed` grouped by `(weekday, hour)` using `served_at`.

---

## 5. Backend API map

All routes are under `/api`.

### Auth
| Method | Path                     | Notes                                                            |
| ------ | ------------------------ | ---------------------------------------------------------------- |
| POST   | `/auth/register`         | body requires `state` + `pincode`; sets httpOnly cookie          |
| POST   | `/auth/login`            | sets httpOnly cookie                                             |
| POST   | `/auth/logout`           | clears cookie                                                    |
| GET    | `/auth/me`               | returns `{user, businesses: [...]}`                              |

### Business (owner, authenticated)
| Method | Path                                          | Notes                                    |
| ------ | --------------------------------------------- | ---------------------------------------- |
| GET    | `/business`                                   | list owner's outlets                     |
| POST   | `/business`                                   | create new outlet                        |
| GET    | `/business/{id}`                              | 404 if not owner                         |
| PATCH  | `/business/{id}`                              | update any of the editable fields        |
| DELETE | `/business/{id}`                              | cascades to tickets                      |
| GET    | `/business/{id}/queue?status=waiting\|serving`| returns waiting+serving by default       |
| POST   | `/business/{id}/queue/walk-in`                | body: `{customer_name, customer_phone?}` |
| POST   | `/business/{id}/queue/call-next`              | promotes next waiting to serving         |
| PATCH  | `/business/{id}/queue/{ticket_id}/status`     | body: `{status}`                         |
| GET    | `/business/{id}/stats`                        | today-scope counts                       |
| GET    | `/business/{id}/analytics?days=N`             | 1 ≤ N ≤ 90, default 14                   |

### Public (no auth)
| Method | Path                                           | Notes                                        |
| ------ | ---------------------------------------------- | -------------------------------------------- |
| GET    | `/public/business/{id}`                        | business info                                |
| GET    | `/public/business/{id}/queue-summary`          | counts for join page                         |
| POST   | `/public/business/{id}/join`                   | creates ticket                               |
| GET    | `/public/ticket/{ticket_id}`                   | live status + position + ETA                 |
| GET    | `/public/business/{id}/display`                | TV feed (serving + upcoming + waiting_count) |

---

## 6. Frontend routes map

| Route                                | Access    | Purpose                                    |
| ------------------------------------ | --------- | ------------------------------------------ |
| `/`                                  | Public    | Landing / marketing                        |
| `/login`                             | Public    | Owner login                                |
| `/register`                          | Public    | Owner + first-outlet signup                |
| `/dashboard`                         | Protected | Redirect to first outlet / `/dashboard/outlets` |
| `/dashboard/outlets`                 | Protected | List + create + delete outlets             |
| `/dashboard/:businessId`             | Protected | Live queue for that outlet                 |
| `/dashboard/:businessId/settings`    | Protected | Outlet settings                            |
| `/dashboard/:businessId/analytics`   | Protected | Charts + heatmap                           |
| `/join/:businessId`                  | Public    | Customer join form                         |
| `/ticket/:ticketId`                  | Public    | Live ticket status                         |
| `/display/:businessId`               | Public    | Lobby TV "Now Serving" board               |

---

## 7. Try it — 60-second tour

Demo credentials (seeded on backend startup):

- Email: `admin@go-next.in`
- Password: `admin123`
- Outlets: `demo-salon` (Bandra, 4 chairs) + `demo-salon-andheri` (Andheri, 3 chairs).

Journey:
1. Open `/` → click **Sign in** → auto-filled demo credentials → **Sign in**.
2. You land on `/dashboard/demo-salon`. Switch to **Andheri** from the outlet dropdown to see the multi-outlet switcher.
3. Click **Walk-in** → add "Priya". A token #001 appears.
4. Click **Call next** → Priya moves to serving on Chair 1.
5. Click **Done** on Priya's row → stats update.
6. Open `/join/demo-salon` in another tab → submit a name → you get a ticket page polling live.
7. Open `/display/demo-salon` in a third tab to see the TV board.
8. Back on the dashboard, click **Analytics** tab — pick "Last 30 days" — see the bar chart and heatmap update.

---

## 8. Architecture cheatsheet

```
React (frontend) ── axios withCredentials ──► FastAPI (/api)
       │                                          │
       │                                          └── Motor (async Mongo)
       │                                                      │
       ▼                                                      ▼
   Browser cookies (httpOnly JWT)                      MongoDB collections
                                                      users / businesses / queue
```

- Hot reload on both frontend (CRACO) and backend (uvicorn + watchfiles).
- Env values live only in `/app/frontend/.env` and `/app/backend/.env`; never hard-coded.
- Shadcn/ui components customized to the **Warm Sand + Terracotta + Moss** palette; fonts: Cormorant Garamond + Outfit.
- Live updates: polling (3s dashboard, 4s ticket, 3s display). No WebSockets (yet).

---

## 9. Change log

### v2 — 2026-02 (current)
- **Multi-outlet / chain support.** One owner can have many businesses. Dashboard header has an outlet switcher; new `/dashboard/outlets` page to list/create/delete outlets. `auth/me` now returns `businesses: [...]`. Queue endpoints moved under `/api/business/{id}/queue/*`.
- **Owner analytics** at `/dashboard/:id/analytics`: stat cards, per-day bar chart (`recharts`), 7×24 busy-hour heatmap, range selector 7/14/30/90 days. Added `no_show` status + `served_at` timestamp for accurate metrics.
- **Public TV "Now Serving" display** at `/display/:businessId` (public, dark layout, live clock, 3s refresh).
- Second outlet (`demo-salon-andheri`) seeded for demo.

### v1.1 — 2026-02
- Signup tweaks: removed "Number of stations / chairs"; **State** + **Pincode** now required; added live `go-next.in/join/{slug}` preview on the signup page; demo admin email moved to `admin@go-next.in`.

### v1 — 2026-02 (initial rebuild)
- Rebuilt the Next.js + Supabase repo as React + FastAPI + MongoDB with JWT auth.
- Landing, Login, Register, single-outlet Dashboard, Settings, Customer Join + live Ticket status, QR code download/copy.

---

## 10. How this document is maintained

**Rule**: every time a feature is added, a bug is fixed, or a route changes, update the relevant section(s) of this file **and** add a short bullet to the change log with the date. Keep sections concise — link to code if needed, don't duplicate it.

When unsure whether a change belongs here, ask: *"Would a new developer or the user themself need to know this to understand the app?"* If yes, update.
