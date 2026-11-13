import json
from datetime import date

from fastapi import Request
from pymongo import ReturnDocument

from app.core.errors import DomainError, require
from app.core.security import digest, now
from app.repositories.store import Store


def store(request: Request):
    require(request.app.state.ready, "Database is unavailable; check server configuration", 503, "NOT_READY")
    return Store(request.app.state.db)


async def audit(request, actor, action, resource_type, resource_id, room_id=None, metadata=None):
    await store(request).insert(
        "audit_logs",
        {
            "actor_user_id": actor["_id"] if actor else None,
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "room_id": room_id,
            "metadata_safe": metadata or {},
            "request_id": getattr(request.state, "request_id", ""),
        },
    )


async def room_access(request, room_id, user, admin=False, write=False):
    room = await store(request).get(
        "rooms", {"_id": room_id, "members": {"$elemMatch": {"user_id": user["_id"], "status": "active"}}}
    )
    membership = next(x for x in room["members"] if x["user_id"] == user["_id"])
    require(not admin or membership["role"] == "room_admin", "Room administrator access required", 403)
    require(not write or room["status"] == "active", "Room is archived", 409)
    return room, membership


async def category_access(request, category_id, scope_key):
    if category_id:
        await store(request).get(
            "categories", {"_id": category_id, "scope_key": scope_key, "is_active": True}
        )


async def throttle(request, action, identifier="", limit=10, seconds=60):
    db = store(request).db
    timestamp = now()
    bucket = int(timestamp.timestamp()) // seconds
    client = request.client.host if request.client else "unknown"
    key = digest(f"{action}:{client}:{identifier.lower()}:{bucket}")
    from datetime import timedelta

    doc = await db.rate_limits.find_one_and_update(
        {"_id": key},
        {"$inc": {"count": 1}, "$setOnInsert": {"expires_at": timestamp + timedelta(seconds=seconds * 2)}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    require(doc["count"] <= limit, "Too many attempts. Please try again later.", 429, "RATE_LIMITED")


def request_hash(body):
    return digest(json.dumps(body, sort_keys=True, separators=(",", ":"), default=str))


async def financial_create(request, collection, room_id, user, body, extra):
    key = request.headers.get("Idempotency-Key", "")
    require(8 <= len(key) <= 128, "Idempotency-Key header (8–128 characters) is required", 422)
    fingerprint = request_hash({"actor": user["_id"], **body})
    query = {"room_id": room_id, "idempotency_key": key}
    existing = await store(request).db[collection].find_one(query)
    if existing:
        require(
            existing["request_hash"] == fingerprint, "Idempotency key already used for another request", 409
        )
        return existing, False
    try:
        doc = await store(request).insert(
            collection,
            {
                **body,
                **extra,
                "room_id": room_id,
                "created_by": user["_id"],
                "idempotency_key": key,
                "request_hash": fingerprint,
                "audit_event": {"actor_user_id": user["_id"], "action": f"{collection}.create", "at": now()},
            },
        )
    except DomainError as error:
        if error.status != 409:
            raise
        existing = await store(request).db[collection].find_one(query)
        require(
            existing and existing["request_hash"] == fingerprint,
            "Idempotency key already used for another request",
            409,
        )
        return existing, False
    return doc, True


def date_query(from_date: date | None, to_date: date | None):
    require(not (from_date and to_date) or from_date <= to_date, "Invalid date range", 422)
    result = {}
    if from_date:
        result["$gte"] = from_date.isoformat()
    if to_date:
        result["$lte"] = to_date.isoformat()
    return {"expense_date": result} if result else {}
