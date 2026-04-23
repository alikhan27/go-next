# Go-Next · Salon Queue System — PRD

**Source problem statement**: "Here is the GIT url https://github.com/alikhan27/salon-queue-system.git — Please improve the code base."

The original repo was a Next.js + Supabase queue app. Rebuilt on Emergent's React + FastAPI + MongoDB template with a calm, organic "Warm Sand + Terracotta + Moss" aesthetic per the design agent.

## Architecture
- **Frontend**: React 19 + React Router 7, Shadcn/ui, Tailwind, Outfit + Cormorant Garamond fonts, axios (`withCredentials`), `qrcode.react`.
- **Backend**: FastAPI + Motor (MongoDB). JWT auth in an httpOnly cookie (7‑day). All routes prefixed with `/api`.
- **Persistence**: MongoDB collections — `users`, `businesses`, `queue`.

## User personas
- **Business owner / manager**: registers, opens a live queue board, adds walk-ins, calls next guest, toggles online/offline.
- **Customer**: scans a QR or opens `/join/:businessId`, enters name+phone, gets a live ticket with position + ETA.

## Core requirements (static)
- One-page owner dashboard with queue control, stats, and QR.
- Public customer join + live ticket status.
- JWT auth (register/login/logout/me).
- Editable settings (chairs, token limit, online toggle, station label, address).

## Implemented (v1 — 2026-02)
- JWT auth (cookie + bearer fallback), seeded demo owner `admin@gonext.com / admin123`, demo business `demo-salon`.
- `/api/auth/*`, `/api/business/me`, `/api/public/business/:id{…}`, `/api/public/ticket/:id`, `/api/queue/manage{,/walk-in,/call-next,/:id/status,/stats}`.
- Frontend: Landing, Login (prefilled demo), Register, Dashboard (3s polling, walk-in dialog, call-next, online toggle, QR + link copy + SVG download), Settings, JoinQueue, TicketStatus (4s polling).
- Visual identity per `/app/design_guidelines.json` (Warm Sand/#F9F8F6, Terracotta/#C47C5C, Moss/#7D9276).
- Verified by the testing agent: 17/17 backend tests pass, all UI flows pass.

## Backlog (P1)
- WhatsApp/SMS notification on "your turn" (Twilio).
- Owner analytics (daily/weekly charts on completions, no-show rate).
- Multi-outlet / chain support (owner ↔ many businesses).
- Per-service pricing and service duration overrides.
- Subscription / paid plan gating (Stripe).

## Backlog (P2)
- Customer-facing scheduled slot booking.
- Staff accounts under an owner.
- Public TV display mode for "now serving" screen.
- Import from Google Reviews / QR poster templates.

## Known trade-offs
- Live updates via polling (3s/4s) instead of WebSockets — simple and reliable for this scale.
- `_today` stats use regex on ISO date prefix; good enough, can be indexed later.
- One business per owner (DB uniqueness); multi-outlet requires model extension.
