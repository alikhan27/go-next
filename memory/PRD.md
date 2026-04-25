# Go-Next · Salon Queue System — PRD

**Source problem statement**: "Here is the GIT url https://github.com/alikhan27/salon-queue-system.git — Please improve the code base."

Rebuilt from Next.js+Supabase onto React + FastAPI + MongoDB with a calm, organic "Warm Sand + Terracotta + Moss" aesthetic.

## Architecture
- **Frontend**: React 19, React Router 7, Shadcn/ui, Tailwind, `recharts`, `qrcode.react`, Cormorant Garamond + Outfit fonts.
- **Backend**: FastAPI + Motor (MongoDB). JWT auth in httpOnly cookie (7-day). Everything prefixed `/api`.
  - Entrypoint: `/app/backend/server.py` (slim, 60 lines — mounts routers + middleware + startup)
  - Routers: `/app/backend/app/routers/{auth,business,queue,public,plans,admin}.py`
  - Shared core: `/app/backend/app/{config,db,security,models,services,startup}.py`
- **Collections**: `users`, `businesses`, `queue`, `login_attempts`, `password_resets`, `account_lock_tokens`.

## User personas
- **Business owner / manager**: can own multiple outlets (plan-gated), each with its own queue board, analytics, QR poster and TV display.
- **Customer**: scans a QR / opens `/join/:businessId`, enters name+phone, gets a live ticket with position + ETA.
- **Lobby screen** (TV): opens `/display/:businessId` fullscreen — public, auto-refreshing "Now Serving" board.
- **Super admin**: manages every owner's plan + every outlet + security lockouts from `/admin`.

## Core requirements (static)
- Multi-outlet owner dashboard with queue control, stats, QR poster, TV display link.
- Public customer join + live ticket status.
- JWT auth (register/login/logout/me) with brute-force lockout (5 failures / 15 min / email).
- Per-outlet editable settings (chairs, token limit, online toggle, station label, address).
- Owner analytics: completions per day, no-show rate, busy-hour heatmap, avg service time.
- Forgot-password flow (preview mode) + "Wasn't you?" account-freeze flow.
- Super admin panel with sortable/searchable/paginated tables for Owners, Outlets, Security.
- Free vs Premium plan gating (free: 1 outlet, 2 stations, 50 tokens/day, 14-day analytics).
- First-time owner onboarding wizard (4 steps: welcome → stations → QR → TV display).
- Printable customer-facing QR poster per outlet.

## Implemented
### v1 — 2026-02
- JWT auth (cookie + bearer fallback), seeded demo owner.
- Single-outlet per owner, live queue control, settings, QR, customer join + ticket polling.

### v2 — 2026-02
- **Multi-outlet / chain support** — owner can have many businesses. Queue endpoints under `/api/business/{id}/queue/*`. Outlet switcher + `/dashboard/outlets`.
- **Public TV "Now Serving" display** at `/display/:businessId` (public, 3s auto-refresh).
- **Owner analytics** — completed/no-show daily, busy-hour heatmap, avg service time.
- Two seeded outlets (Bandra + Andheri).

### v3 — 2026-02
- **Free vs Premium plans** with plan-limit enforcement on outlet create + chairs/token PATCH. Pricing section on landing.
- **Super Admin panel** `/admin` (plan toggle, lock/unlock, outlet delete, search + sort + pagination).
- **Brute-force lockout** on `/api/auth/login` (5 fails / 15 min / email, TTL index auto-expires).
- **Forgot-password** + **"Wasn't you?" account freeze** flow (preview mode returns links in API response).

### v4 — 2026-02
- **Backend modular refactor** — monolithic `server.py` split into routers + shared core (`app/config.py`, `db.py`, `security.py`, `models.py`, `services.py`, `startup.py` + 6 routers). Zero behavior change.
- **Customer QR poster** `/dashboard/:id/qr-poster` — printable A4 poster.
- **Owner onboarding wizard** `/dashboard/:id/onboarding` — 4-step guided setup.

### v5 — 2026-02 (current)
- **Three plan tiers**: Free (1 outlet / 3 chairs / 50 tokens / no services), Premium (3 outlets / 10 chairs / 200 tokens / services), Premium Plus (25 outlets / 10 chairs / 500 tokens / services / 180-day analytics). Plan helper at `/app/frontend/src/lib/plans.js`.
- **Outlet services** (Premium+): owners list/create/update/toggle/delete services with name + duration in minutes via `/dashboard/:id/services`. Stored in `services` collection. Customer join page renders an interactive service picker; if the outlet has any active services, picking one is required.
- **Service-aware ETA**: tickets snapshot `service_id`/`service_name`/`service_duration_minutes` at join. `queue-summary` and `ticket-status` compute `estimated_wait_minutes` from sums of waiting durations / chairs (15min fallback when ticket has no service).
- **Login no longer advertises super admin** demo creds. The seed for `super@go-next.in` still runs server-side for the platform owner.
- Verified: 55/55 backend pytest pass, all UI flows pass (testing agent iter 5).

## Backlog (P1)
- WhatsApp/SMS "your turn" notifications via Twilio.
- CSV export of analytics.
- Staff accounts under an owner (role-based).

## Backlog (P2)
- Stripe integration for self-serve Premium upgrade (replaces manual super-admin toggle).
- Real email integration (Resend/SendGrid) to replace Preview Mode for forgot-password + account-freeze.
- Customer scheduled slot booking.
- Customer-facing "queues near you" directory using pincode + geolocation.

## Known trade-offs
- Live updates via polling (3s/4s) — simple, reliable at this scale.
- Analytics `completed_today` / `no_show_today` use regex on ISO date prefix; fine for small-scale, can be indexed later.
- Preview mode for reset/lock tokens returns the link in the API response instead of emailing it.
