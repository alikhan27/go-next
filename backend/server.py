"""Go-Next Salon Queue API — slim FastAPI entrypoint.

All business logic lives under `app.routers.*`. This file only wires the
router, middleware and startup/shutdown hooks.
"""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import logging
import os
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import client
from app.routers import admin as admin_router
from app.routers import auth as auth_router
from app.routers import business as business_router
from app.routers import plans as plans_router
from app.routers import public as public_router
from app.routers import queue as queue_router
from app.routers import services as services_router
from app.startup import ensure_indexes, load_runtime_settings, seed_demo_data
from app.redis_client import close_redis


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await ensure_indexes()
    await seed_demo_data()
    await load_runtime_settings()
    yield
    # Shutdown
    client.close()
    await close_redis()


app = FastAPI(title="Go-Next Salon Queue API", lifespan=lifespan)

api = APIRouter(prefix="/api")
api.include_router(auth_router.router)
api.include_router(business_router.router)
api.include_router(queue_router.router)
api.include_router(services_router.router)
api.include_router(services_router.public_router)
api.include_router(public_router.router)
api.include_router(plans_router.router)
api.include_router(admin_router.router)


app.include_router(api)

# Configure CORS from environment variable
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
if cors_origins == "*":
    origins_list = ["*"]
else:
    origins_list = [origin.strip() for origin in cors_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
