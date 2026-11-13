import logging

from pymongo import ASCENDING, AsyncMongoClient

from app.core.security import now, password_hash, uid

logger = logging.getLogger("roommate")


async def indexes(db):
    await db.users.create_index("username", unique=True)
    await db.users.create_index("email", unique=True, sparse=True)
    await db.rooms.create_index("slug", unique=True)
    await db.rooms.create_index("members.user_id")
    await db.categories.create_index([("scope_key", 1), ("normalized_name", 1)], unique=True)
    for name in ("expenses", "settlements"):
        await db[name].create_index([("room_id", 1), ("idempotency_key", 1)], unique=True)
        await db[name].create_index([("room_id", 1), ("created_at", -1)])
    await db.expenses.create_index([("room_id", 1), ("expense_date", -1)])
    await db.personal_expenses.create_index([("owner_user_id", 1), ("expense_date", -1)])
    await db.sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.rate_limits.create_index("expires_at", expireAfterSeconds=0)
    await db.audit_logs.create_index([("room_id", ASCENDING), ("created_at", -1)])
    await db.announcements.create_index([("room_id", 1), ("created_at", -1)])
    await db.announcements.create_index(
        [("room_id", 1), ("status", 1), ("unread_user_ids", 1), ("created_at", -1)]
    )


async def bootstrap(db, settings):
    if not settings.bootstrap_password or await db.users.find_one({"platform_role": "super_admin"}):
        return
    password = settings.bootstrap_password.get_secret_value()
    if len(password) < 12:
        raise ValueError("Bootstrap password must contain at least 12 characters")
    await db.users.insert_one(
        {
            "_id": uid(),
            "username": settings.bootstrap_username.lower(),
            "display_name": "Administrator",
            "password_hash": password_hash(password),
            "platform_role": "super_admin",
            "status": "active",
            "must_change_password": True,
            "auth_version": 0,
            "created_at": now(),
            "updated_at": now(),
        }
    )


def client_for(settings):
    return AsyncMongoClient(
        settings.mongodb_uri.get_secret_value(),
        serverSelectionTimeoutMS=settings.db_timeout_ms,
        tz_aware=True,
    )
