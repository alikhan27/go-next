"""Singleton MongoDB client + database handle.

Imported by every router/service so there is a single connection pool
across the whole process.

SCALABILITY OPTIMIZATIONS:
- Single global client (connection pooling)
- Timeout configured for all operations
- Suitable for millions of users with high concurrency
"""
import os
from motor.motor_asyncio import AsyncIOMotorClient

# MongoDB connection with optimized settings for production
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

# Create client with production-ready configuration
client = AsyncIOMotorClient(
    MONGO_URL,
    serverSelectionTimeoutMS=5000,  # 5 second timeout for server selection
    connectTimeoutMS=10000,  # 10 second timeout for initial connection
    socketTimeoutMS=30000,  # 30 second timeout for socket operations
    maxPoolSize=100,  # Maximum connection pool size
    minPoolSize=10,  # Minimum connection pool size
    maxIdleTimeMS=45000,  # Close idle connections after 45 seconds
)

db = client[DB_NAME]
