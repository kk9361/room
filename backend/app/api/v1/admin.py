from fastapi import APIRouter, Depends, Query, Request

from app.core.errors import require
from app.repositories.store import public
from app.core.security import verify_password
from app.schemas.requests import AccountStatus, ClearApplicationData
from app.services.auth import platform_admin
from app.services.context import audit, store

router = APIRouter(prefix="/admin", tags=["Platform administration"])


@router.get("/rooms")
async def rooms(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user=Depends(platform_admin),
):
    return await store(request).page("rooms", {}, page, page_size)


@router.get("/users")
async def users(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user=Depends(platform_admin),
):
    return await store(request).page("users", {}, page, page_size)


@router.patch("/users/{user_id}/status")
async def account_status(user_id: str, body: AccountStatus, request: Request, user=Depends(platform_admin)):
    require(user_id != user["_id"], "You cannot disable your own administrator account", 409)
    target = await store(request).get("users", {"_id": user_id})
    require(
        target.get("platform_role") != "super_admin", "Super administrator status cannot be changed here", 403
    )
    if body.status == "disabled":
        rooms = (
            await store(request)
            .db.rooms.find(
                {"members": {"$elemMatch": {"user_id": user_id, "role": "room_admin", "status": "active"}}}
            )
            .to_list(length=None)
        )
        for room in rooms:
            others = [
                m["user_id"]
                for m in room["members"]
                if m["user_id"] != user_id and m["role"] == "room_admin" and m["status"] == "active"
            ]
            require(
                await store(request).db.users.count_documents({"_id": {"$in": others}, "status": "active"})
                > 0,
                "Transfer room administration before disabling this account",
                409,
            )
    result = await store(request).update("users", {"_id": user_id}, body.model_dump())
    if body.status == "disabled":
        await store(request).db.sessions.update_many({"user_id": user_id}, {"$set": {"revoked": True}})
    await audit(request, user, "admin.account_status", "user", user_id, metadata=body.model_dump())
    return public(result)


@router.patch("/rooms/{room_id}/status")
async def room_status(room_id: str, body: dict, request: Request, user=Depends(platform_admin)):
    require(set(body) == {"status"} and body["status"] in ("active", "archived"), "Invalid room status", 422)
    result = await store(request).update("rooms", {"_id": room_id}, body)
    await audit(request, user, "admin.room_status", "room", room_id, room_id, body)
    return public(result)


@router.get("/audit-logs")
async def audit_logs(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    room_id: str | None = None,
    user=Depends(platform_admin),
):
    return await store(request).page("audit_logs", {"room_id": room_id} if room_id else {}, page, page_size)


@router.post("/clear-data")
async def clear_application_data(body: ClearApplicationData, request: Request, user=Depends(platform_admin)):
    require(
        verify_password(body.current_password, user["password_hash"]),
        "Administrator password is incorrect",
        422,
    )
    db = store(request).db
    deleted = {}
    collections = [name for name in await db.list_collection_names() if not name.startswith("system.")]
    # Keep the operator's account and sessions until the rest of the wipe has
    # succeeded. Users are removed last, so a failure partway through does not
    # lock the administrator out while application data remains.
    collections.sort(key=lambda name: (2 if name == "users" else 1 if name == "sessions" else 0, name))
    for name in collections:
        result = await db[name].delete_many({})
        deleted[name] = result.deleted_count
    return {
        "deleted_counts": deleted,
        "total_deleted": sum(deleted.values()),
        "database_empty": True,
    }
