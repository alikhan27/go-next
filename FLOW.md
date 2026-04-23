# Go-Next · Flow Document

> One place to understand how the Salon Queue app works end-to-end — for you, future agents, and anyone joining the project.
> Updated on every feature / bug-fix iteration.

**Last updated**: 2026-02 — iteration 10 (backend modular refactor + customer QR poster + owner onboarding wizard)

---

## 1. What this app does

Go-Next is a calm, organic queue-management app for salons, clinics, spas, restaurants and similar service businesses. It replaces paper notebooks and chaotic WhatsApp groups at the front desk.

Three audiences use it:

| Audience              | What they do                                                                  | Where they are                 |
| --------------------- | ----------------------------------------------------------------------------- | ------------------------------ |
| Business owner        | Creates outlets (plan-limited), manages live queue, views analytics           | `/login`, `/dashboard/…`       |
| Customer / guest      | Scans a QR, joins the queue, watches live position & ETA                      | `/join/:id`, `/ticket/:id`     |
| Lobby TV              | Displays the "Now Serving" board fullscreen on a screen in the salon          | `/display/:id`                 |
| Super admin           | Manages every owner's plan + every outlet across the platform                 | `/admin`                       |

---

## 2. The three flows at a glance

### 2.1 Owner flow
1. Visit `/` → click **Create account**.
2. On `/register`, enter name, email, password, business name/type, address, **state + pincode (required)**. `total_chairs` is NOT asked — defaults to 1 and is editable in Settings.
3. After register → redirected to **`/dashboard/{first-outlet-id}/onboarding`** (4-step wizard: welcome → set stations → share customer QR → open TV display). Owner can click **Skip for now** to jump straight to the dashboard. Completion is remembered in `localStorage` under `gonext:onboarded:{userId}`.
4. From the dashboard, the QR card has a **Print poster for reception** link that opens `/dashboard/{id}/qr-poster` — a printable A4 poster with the outlet name, branding and the customer join QR.
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

### Plans (public)
| Method | Path       | Notes                                                     |
| ------ | ---------- | --------------------------------------------------------- |
| GET    | `/plans`   | Returns Free + Premium cards with limits + features       |

### Auth
| Method | Path                     | Notes                                                            |
| ------ | ------------------------ | ---------------------------------------------------------------- |
| POST   | `/auth/register`         | body requires `state` + `pincode`; sets httpOnly cookie          |
| POST   | `/auth/login`            | sets httpOnly cookie; locks after 5 failures / 15 min             |
| POST   | `/auth/logout`           | clears cookie                                                    |
| GET    | `/auth/me`               | returns `{user, businesses: [...]}`                              |
| POST   | `/auth/forgot-password`  | body `{email}`; returns 200 always; in preview mode includes `preview_reset_link` |
| POST   | `/auth/reset-password`   | body `{token, new_password}`; single-use; 30-min TTL; response also includes `preview_lock_link` (24 h) |
| POST   | `/auth/lock-account`     | body `{token}`; freezes the account (security alert flow)         |

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

### Super admin (role=super_admin)
| Method | Path                                           | Notes                                         |
| ------ | ---------------------------------------------- | --------------------------------------------- |
| GET    | `/admin/stats`                                 | Platform-wide counts                          |
| GET    | `/admin/users`                                 | Owners with plan + outlet count               |
| PATCH  | `/admin/users/{id}`                            | `{plan: "free" | "premium"}`                  |
| GET    | `/admin/businesses`                            | Every outlet across owners                    |
| DELETE | `/admin/businesses/{id}`                       | Delete any outlet (cascades to tickets)       |
| GET    | `/admin/security/lockouts`                     | List locked/warned accounts with unlock ETA   |
| DELETE | `/admin/security/lockouts/{email}`             | Clear a specific account's login attempts    |

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
| `/dashboard/whats-new`               | Protected | In-app change log / release notes          |
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

### v2.6 — 2026-02 (current)
- **Post-reset security alert**. `POST /api/auth/reset-password` now also issues a one-time **account-lock** token (24 h TTL, stored in `account_lock_tokens`). In preview mode the response includes `preview_lock_link`, rendered on the reset-success page as a red "Wasn't you?" card with Copy / Lock my account buttons.
- New endpoint `POST /api/auth/lock-account` + public page `/lock-account?token=…` — confirmation screen → sets `user.is_locked = true` + `locked_reason` + invalidates other outstanding reset tokens.
- Login endpoint now returns **403** "Account frozen for safety…" whenever `user.is_locked` is true — even with the correct password.
- Admin **Owners** tab shows a red **Frozen** badge + a **Restore** button. `PATCH /api/admin/users/{id}` extended to accept `{is_locked: false}`; unlock also clears login throttling on that email.

### v2.5 — 2026-02
- **Forgot-password flow.** New routes `/forgot-password` + `/reset-password?token=…`. Backend endpoints `POST /api/auth/forgot-password` and `POST /api/auth/reset-password`.
  - Tokens are 43-char URL-safe random strings stored in `password_resets` with a MongoDB TTL index on `expires_at` (30-minute lifespan).
  - Tokens can be used once — second use returns 400 "already been used".
  - **Preview mode** (default): the reset link is returned in the API response and displayed with copy + open buttons on the `/forgot-password` page. Swap to Resend/SendGrid later by setting `PASSWORD_RESET_PREVIEW_MODE = False` and plugging in a mailer.
  - Forgot response is identical for known + unknown emails (no user enumeration).
  - Successful reset also clears any active login lockout for that email.

### v2.4 — 2026-02
- **Security tab in `/admin`**. Super admin can now see every recently-locked-out account (with live countdown) and clear a lockout in one click. Backed by `GET /api/admin/security/lockouts` + `DELETE /api/admin/security/lockouts/{email}`. Tab shows a small red dot whenever at least one account is currently locked.

### v2.3 — 2026-02
- **Brute-force lockout on `/api/auth/login`.** After 5 failed attempts for the same email within 15 minutes the endpoint returns `429 Too many failed attempts. Try again in N minute(s).` A successful login (or the 15-minute window expiring) clears the counter. Backed by a new `login_attempts` collection with a MongoDB TTL index (auto-deletes attempts after the window). Constants `LOCKOUT_THRESHOLD=5` and `LOCKOUT_WINDOW_MINUTES=15` live in `server.py`. The lockout key is the email (standard account-lockout pattern) because our K8s ingress rotates proxy IPs, which would otherwise under-count attempts.

### v2.2 — 2026-02
- **Free / Premium plans.**
  - Free: 1 outlet, 2 stations, 50 tokens/day, 14-day analytics.
  - Premium: 10 outlets, 100 stations, 1000 tokens/day, 90-day analytics, TV display.
  - Enforced at `POST /api/business` and `PATCH /api/business/{id}`. `GET /api/plans` returns marketing copy.
- **Pricing section** on the landing page (`/#pricing`), with two cards side-by-side.
- **Super admin** role. Seeded `super@go-next.in / admin123`. Separate login redirect to `/admin`.
  - New endpoints: `GET /api/admin/stats`, `GET /api/admin/users`, `PATCH /api/admin/users/{id}` (plan), `GET /api/admin/businesses`, `DELETE /api/admin/businesses/{id}` — all guarded by `role == super_admin`.
  - `/admin` page has Owners / Outlets / Overview tabs with inline upgrade / downgrade and outlet delete.
- **Plan badge** in the dashboard header; **upgrade banner** on the Outlets page when a Free owner hits the 1-outlet limit.

### v2.1 — 2026-02
- **In-app "What's new" page** at `/dashboard/whats-new`, linked from the dashboard header and the user menu. Uses `localStorage` key `gonext:whatsnew:seen` + `LATEST_VERSION` from `src/lib/releases.js` to show a small terracotta **unread dot** on the header link until the page is viewed. Release entries live in one file (`releases.js`) — adding a new release = bump `LATEST_VERSION` and prepend to `RELEASES`.

### v2 — 2026-02
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
with JWT auth.
- Landing, Login, Register, single-outlet Dashboard, Settings, Customer Join + live Ticket status, QR code download/copy.

---

## 10. How this document is maintained

**Rule**: every time a feature is added, a bug is fixed, or a route changes, update the relevant section(s) of this file **and** add a short bullet to the change log with the date. Keep sections concise — link to code if needed, don't duplicate it.

When unsure whether a change belongs here, ask: *"Would a new developer or the user themself need to know this to understand the app?"* If yes, update.
