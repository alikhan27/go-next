# Go-Next - Queue Management System

A modern, calm queue management application for salons, clinics, spas, and restaurants.

## Overview

Go-Next replaces paper notebooks and chaotic WhatsApp groups at the front desk with a clean, organic queue management solution.

### Tech Stack
- **Frontend**: React 19, React Router 7, Shadcn/ui, Tailwind CSS (built with CRA + Craco)
- **Backend**: FastAPI + Motor (async MongoDB driver)
- **Cache / Sessions**: Redis (token-keyed multi-device sessions, login rate-limiting, per-user cache)
- **Authentication**: JWT in httpOnly cookies, server-side revocation via Redis

## How the pieces fit together

The app runs as **four independent processes** that talk to each other over the network. All four must be up for login to succeed.

```
┌─────────────────┐
│  React (CRA)    │      Browser-side UI. Calls the API at
│  :3000          │ ───► REACT_APP_BACKEND_URL on every request.
│  (yarn start)   │
└────────┬────────┘
         │ HTTPS (httpOnly cookie carries the JWT)
         ▼
┌─────────────────┐      The API server. uvicorn is the ASGI process
│  FastAPI        │      that hosts the FastAPI `app` object — it owns
│  :8001          │      the port, parses HTTP, calls your route handlers.
│  (uvicorn)      │      Without it, your Python code never sees a request.
└──┬───────────┬──┘
   │           │
   │           └────────────────────────┐
   ▼                                    ▼
┌─────────────────┐              ┌─────────────────┐
│   MongoDB       │              │     Redis       │
│   :27017        │              │     :6379       │
│                 │              │                 │
│ Source of truth │              │ Hot, ephemeral  │
│ for users,      │              │ state:          │
│ businesses,     │              │  • sessions     │
│ tickets,        │              │  • rate-limits  │
│ services,       │              │  • user cache   │
│ analytics.      │              │  • lockouts     │
└─────────────────┘              └─────────────────┘
```

**Why uvicorn?** FastAPI is just a Python library that defines routes — it doesn't open a socket on its own. uvicorn is the *web server* that listens on port 8001, accepts HTTP, and hands each request to FastAPI. (Same role as `node index.js` for Express, or `rails server` for Rails.) It's chosen over Gunicorn because FastAPI is async and uvicorn speaks the matching ASGI protocol.

**Why Redis is mandatory.** The backend deliberately offloads three hot-path concerns to Redis to keep MongoDB cool under load:
1. **Sessions** — every authenticated request looks up `session:{token}` in Redis. No Redis ⇒ login appears to work but the next request returns `401`.
2. **Login rate-limiting** — counts failed attempts per email and locks accounts. The `/auth/login` endpoint touches Redis before it ever queries Mongo, so a Redis outage surfaces as a `500` on login.
3. **Per-user cache** — `user:{user_id}` is read on every authenticated request; Mongo is hit only on cache miss.

**Why MongoDB is mandatory.** It stores the actual durable data (users, businesses, tickets, password hashes). Cold starts read from here to warm Redis.

**Startup order:** Mongo + Redis first (they don't depend on anything), then uvicorn (which connects to both at boot), then the frontend (which connects to uvicorn).

## Features

### For Business Owners
- Multi-outlet management with plan-based limits (Free/Premium/Premium Plus)
- Live queue control dashboard
- Service management with duration tracking
- Analytics with completion rates, no-show tracking, busy-hour heatmaps
- Printable QR posters for customer onboarding
- TV display mode for lobby screens

### For Customers
- Scan QR to join queue
- Live position and ETA tracking
- Service selection (Premium plans)
- Real-time updates

### For Super Admins
- Plan management across all owners
- Security lockout management
- Outlet administration

## Getting Started

### Prerequisites
- **Node.js** 18+ (Node 22 is what we use; the project ships a `packageManager` field for yarn)
- **Python** 3.11+
- **MongoDB** running locally on `:27017`
- **Redis** running locally on `:6379`
- **yarn** (this repo is yarn-only — see Troubleshooting below if you accidentally `npm install`)

On macOS:
```bash
brew tap mongodb/brew                                  # MongoDB lives in its own tap
brew install mongodb-community redis
brew services start mongodb-community
brew services start redis
corepack enable                                        # ships with Node 18+, exposes yarn
```

Sanity-check both are listening:
```bash
mongosh --eval "db.runCommand({ ping: 1 })"            # → { ok: 1 }
redis-cli ping                                         # → PONG
```

### 1. Clone

```bash
git clone https://github.com/alikhan27/go-next.git
cd go-next
```

### 2. Backend (`:8001`)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Create backend/.env
cat > .env <<'EOF'
MONGO_URL="mongodb://localhost:27017"
DB_NAME="go_next_db"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="change-me-to-a-long-random-string"
CORS_ORIGINS="http://localhost:3000"
ADMIN_EMAIL="admin@go-next.in"
ADMIN_PASSWORD="Demo@1234"
# Optional tuning:
# BCRYPT_ROUNDS=12          # lower (e.g. 10) for faster login under load
# REDIS_MAX_CONNECTIONS=100
EOF

uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

Seed accounts (`admin@go-next.in` and `super@go-next.in`) are created automatically on first startup.

### 3. Frontend (`:3000`)

```bash
cd frontend

# frontend/.env
echo 'REACT_APP_BACKEND_URL=http://localhost:8001' > .env

yarn install
yarn start
```

Open http://localhost:3000 and log in with the demo credentials below.

## Daily start / stop

After the first-time setup above, this is all you need every time you sit down to work. Each block runs in its **own terminal tab** — keep them open side by side.

### Tab 1 — MongoDB + Redis (one-time per boot)
On macOS the brew services keep running in the background, so usually you don't need to touch them. To verify or restart:
```bash
brew services list                     # check status
brew services start mongodb-community  # if "stopped"
brew services start redis              # if "stopped"
```

### Tab 2 — Backend
```bash
cd ~/ws/go-next/backend
source .venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```
Leave it running. `--reload` picks up Python edits automatically.

### Tab 3 — Frontend
```bash
cd ~/ws/go-next/frontend
yarn start
```
Leave it running. Hot-reloads on every save.

### Stopping
- Backend / Frontend: `Ctrl+C` in the respective tab.
- Mongo / Redis (only if you want to free RAM):
  ```bash
  brew services stop mongodb-community
  brew services stop redis
  ```

### Quick health check
If anything feels off, run these — all three should succeed:
```bash
redis-cli ping                                           # → PONG
mongosh --eval "db.runCommand({ ping: 1 })"              # → { ok: 1 }
curl -s http://localhost:8001/api/                       # → {"message":"..."} or similar 200
```

## Demo Credentials

| Role            | Email                  | Password   |
| --------------- | ---------------------- | ---------- |
| Business owner  | `admin@go-next.in`     | `Demo@1234`|
| Super admin     | `super@go-next.in`     | `Demo@1234`|
| Demo owner      | `demo@go-next.in`      | `Demo@123` |

## Troubleshooting

### `npm install` fails with `ERESOLVE` on `react-day-picker` / `date-fns`
This project uses **yarn**, not npm (note the `packageManager` field in `package.json` and the committed `yarn.lock`). Use:

```bash
rm -rf node_modules package-lock.json
yarn install
```

If you really must use npm, run `npm install --legacy-peer-deps`, but yarn is the supported path.

### Login returns `500 Internal Server Error`
Make sure Redis is running (`redis-cli ping` should return `PONG`). Sessions, rate-limiting, and the user cache all require Redis — the backend will not work without it.

### Backend can't connect to MongoDB
Verify `MONGO_URL` in `backend/.env` and that `mongod` is listening on `:27017` (`mongosh` should connect cleanly).

## Plan Tiers

### Free
- 1 outlet
- 3 stations max
- 50 tokens/day
- 7-day analytics

### Premium
- 3 outlets
- 10 stations per outlet
- 200 tokens/day
- Custom services
- 90-day analytics

### Premium Plus
- 25 outlets
- 10 stations per outlet
- 500 tokens/day
- Custom services
- 180-day analytics
- Dedicated support

## Documentation

- [FLOW.md](/FLOW.md) - Complete application flow documentation
- [PRD.md](/memory/PRD.md) - Product requirements document
- [FIXES_APPLIED.md](/FIXES_APPLIED.md) - Recent fixes and improvements

## Testing

Run backend tests:
```bash
cd backend
python -m pytest tests/ -v
```

## Recent Updates (April 2025)

✅ Fixed CORS configuration to respect environment variables  
✅ Migrated from deprecated `@app.on_event` to `lifespan` context manager  
✅ Fixed Python linting issues (unused variables, unnecessary f-strings)  
✅ Added missing pytest-asyncio dependency  
✅ All services running successfully

## Architecture

- **Backend**: Modular FastAPI with separate routers for auth, business, queue, services, plans, admin, and public endpoints
- **Frontend**: Component-based React with context providers for auth, plans, and theming
- **Database**: MongoDB with proper indexing and TTL for security features

## License

See LICENSE file for details.

## Support

For issues and feature requests, please use the GitHub issue tracker.
