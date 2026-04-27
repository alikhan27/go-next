# Go-Next - Queue Management System

A modern, calm queue management application for salons, clinics, spas, and restaurants.

## Overview

Go-Next replaces paper notebooks and chaotic WhatsApp groups at the front desk with a clean, organic queue management solution.

### Tech Stack
- **Frontend**: React 19, React Router 7, Shadcn/ui, Tailwind CSS
- **Backend**: FastAPI + Motor (MongoDB)
- **Authentication**: JWT (httpOnly cookies, 7-day expiration)

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
- Python 3.11+
- Node.js 18+
- MongoDB
- yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/alikhan27/go-next.git
cd go-next
```

2. Install backend dependencies:
```bash
cd backend
pip install -r requirements.txt
```

3. Install frontend dependencies:
```bash
cd frontend
yarn install
```

4. Configure environment variables:
   - Backend: `/backend/.env`
   - Frontend: `/frontend/.env`

5. Start the services:
```bash
# Backend (port 8001)
cd backend
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Frontend (port 3000)
cd frontend
yarn start
```

## Demo Credentials

- **Owner Account**: admin@go-next.in / admin123
- **Super Admin**: super@go-next.in / admin123

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
