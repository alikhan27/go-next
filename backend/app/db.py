"""Singleton MongoDB client + database handle.

Imported by every router/service so there is a single connection pool
across the whole process.
"""
import os
from motor.motor_asyncio import AsyncIOMotorClient

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]
