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

app = FastAPI(title="Go-Next Salon Queue API")

api = APIRouter(prefix="/api")
api.include_router(auth_router.router)
api.include_router(business_router.router)
api.include_router(queue_router.router)
api.include_router(services_router.router)
api.include_router(services_router.public_router)
api.include_router(public_router.router)
api.include_router(plans_router.router)
api.include_router(admin_router.router)


@app.on_event("startup")
async def on_start():
    await ensure_indexes()
    await seed_demo_data()
    await load_runtime_settings()


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
