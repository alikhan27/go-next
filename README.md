# Go-Next - Queue Management System

A modern, calm queue management application for salons, clinics, spas, and restaurants.

## Overview

Go-Next replaces paper notebooks and chaotic WhatsApp groups at the front desk with a clean, organic queue management solution.

### Tech Stack
- **Frontend**: React 19, React Router 7, Shadcn/ui, Tailwind CSS (built with CRA + Craco)
- **Backend**: FastAPI + Motor (async MongoDB driver)
- **Cache / Sessions**: Redis (token-keyed multi-device sessions, login rate-limiting, per-user cache)
- **Authentication**: JWT in httpOnly cookies, server-side revocation via Redis

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
