# Go-Next · Salon Queue System — PRD

**Source problem statement**: "Here is the GIT url https://github.com/alikhan27/salon-queue-system.git — Please improve the code base."

Rebuilt from Next.js+Supabase onto React + FastAPI + MongoDB with a calm, organic "Warm Sand + Terracotta + Moss" aesthetic.

## Architecture
- **Frontend**: React 19, React Router 7, Shadcn/ui, Tailwind, `recharts`, `qrcode.react`, Cormorant Garamond + Outfit fonts.
- **Backend**: FastAPI + Motor (MongoDB). JWT auth in httpOnly cookie (7‑day). Everything prefixed `/api`.
- **Collections**: `users`, `businesses` (many per owner), `queue` (tickets).

## User personas
- **Business owner / manager**: can own multiple outlets, each with its own queue board, analytics, QR and TV display.
- **Customer**: scans a QR / opens `/join/:businessId`, enters name+phone, gets a live ticket with position + ETA.
- **Lobby screen** (TV): opens `/display/:businessId` fullscreen — public, auto-refreshing "Now Serving" board.

## Core requirements (static)
- Multi-outlet owner dashboard with queue control, stats, QR, TV display link.
- Public customer join + live ticket status.
- JWT auth (register/login/logout/me).
- Per-outlet editable settings (chairs, token limit, online toggle, station label, address).
- Owner analytics: completions per day, no-show rate, busy-hour heatmap, avg service time.

## Implemented
### v1 — 2026-02
- JWT auth (cookie + bearer fallback), seeded demo owner.
- Single-outlet per owner, live queue control, settings, QR, customer join + ticket polling.

### v2 — 2026-02 (current)
- **Multi-outlet / chain support**: owner can have many businesses. `GET /api/business` list, `POST /api/business` create, `PATCH/DELETE /api/business/{id}`. Outlet switcher in the dashboard header. `/dashboard/outlets` list + create + delete page. `auth/me` returns `businesses: [...]`. Queue endpoints moved under `/api/business/{id}/queue/*`.
- **Public TV "Now Serving" display** at `/display/:businessId` (public) — dark, large tokens per station, up-next list, live clock, 3s auto-refresh. Uses `GET /api/public/business/{id}/display`.
- **Owner analytics** at `/dashboard/:businessId/analytics` — stat cards (completed, no-shows, avg service time, daily avg), `recharts` bar chart for per-day completed vs no-show, and a custom CSS-grid busy-hour heatmap (weekday × hour). Backend `GET /api/business/{id}/analytics?days=N`. Added `no_show` status and `served_at` timestamp to support accurate service-time metric + heatmap.
- Two outlets seeded (Bandra + Andheri) to showcase multi-outlet.
- Verified: testing agent — **19/19** backend tests pass, all UI flows pass.

## Backlog (P1)
- WhatsApp/SMS "your turn" notifications via Twilio.
- CSV export of analytics.
- Staff accounts under an owner (role-based).

## Backlog (P2)
- Customer scheduled slot booking.
- Stripe subscription gating for paid plans (multi-outlet beyond N).
- Customer-facing "queues near you" directory using pincode + geolocation.

## Known trade-offs
- Live updates via polling (3s/4s) — simple, reliable at this scale.
- Analytics `completed_today` / `no_show_today` use regex on ISO date prefix; fine for small-scale, can be indexed later.
- TV display has no caching headers yet; polling works but ETag/no-store would be cleaner.
- Brute-force lockout on `/api/auth/login` is NOT implemented yet.
