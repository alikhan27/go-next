import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# Add the backend directory to sys.path to allow importing app
sys.path.append(os.path.join(os.getcwd(), 'backend'))

load_dotenv(Path(os.getcwd()) / "backend" / ".env")

# Ensure you have MONGO_URL and DB_NAME set in your .env
# For this script, we'll connect directly
client = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
db = client[os.environ.get("DB_NAME", "gonext")]

async def clear_login_attempts_collection():
    print(f"Clearing 'login_attempts' collection in database: {db.name}")
    result = await db.login_attempts.delete_many({})
    print(f"Deleted {result.deleted_count} documents from 'login_attempts'.")
    client.close()

if __name__ == "__main__":
    asyncio.run(clear_login_attempts_collection())
