import re
import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, Query, Request
from pymongo import ReturnDocument

from app.core.errors import require
from app.core.security import digest, now, uid
from app.repositories.store import public
from app.schemas.requests import (
    AcceptInvitation,
    Announcement,
    AnnouncementPatch,
    AnnouncementRead,
    Category,
    CategoryPatch,
    Invitation,
    MemberPatch,
    RoomCreate,
    RoomPatch,
)
from app.services.auth import current_user
from app.services.context import audit, room_access, store, throttle

router = APIRouter(tags=["Rooms"])


async def change_room(request, room, changes):
    result = await store(request).db.rooms.find_one_and_update(
        {"_id": room["_id"], "version": room["version"]},
        {"$set": {**changes, "updated_at": now()}, "$inc": {"version": 1}},
        return_document=ReturnDocument.AFTER,
    )
    require(result, "Room changed during this request. Refresh and retry.", 409)
    return result


@router.post("/rooms", status_code=201)
async def create_room(body: RoomCreate, request: Request, user=Depends(current_user)):
    await throttle(request, "create-room", user["_id"], limit=10, seconds=3600)
    slug = re.sub(r"[^a-z0-9]+", "-", body.name.lower()).strip("-")[:60] or "room"
    room = await store(request).insert(
        "rooms",
        {
            **body.model_dump(),
            "slug": f"{slug}-{uid()[:6]}",
            "created_by": user["_id"],
            "currency": "INR",
            "status": "active",
            "version": 0,
            "settings": {"allow_member_expenses": True},
            "invitations": [],
            "members": [
                {"user_id": user["_id"], "role": "room_admin", "status": "active", "joined_at": now()}
            ],
        },
    )
    for name in ("Groceries", "Rent", "Utilities", "Food & dining", "Transport", "Other"):
        await store(request).insert(
            "categories",
            {
                "scope": "room",
                "scope_key": room["_id"],
                "room_id": room["_id"],
                "name": name,
                "normalized_name": name.lower(),
                "icon": "tag",
                "is_active": True,
            },
        )
    await audit(request, user, "room.create", "room", room["_id"], room["_id"])
    return public(room)


@router.get("/rooms")
async def rooms(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user=Depends(current_user),
):
    return await store(request).page(
        "rooms", {"members": {"$elemMatch": {"user_id": user["_id"], "status": "active"}}}, page, page_size
    )


@router.get("/rooms/{room_id}")
async def get_room(room_id: str, request: Request, user=Depends(current_user)):
    room, _ = await room_access(request, room_id, user)
    return public(room)


@router.patch("/rooms/{room_id}")
async def patch_room(room_id: str, body: RoomPatch, request: Request, user=Depends(current_user)):
    room, _ = await room_access(request, room_id, user, admin=True)
    changes = body.model_dump(exclude_none=True)
    if "allow_member_expenses" in changes:
        changes["settings"] = {
            **room["settings"],
            "allow_member_expenses": changes.pop("allow_member_expenses"),
        }
    result = await change_room(request, room, changes)
    await audit(request, user, "room.update", "room", room_id, room_id)
    return public(result)


@router.get("/rooms/{room_id}/members")
async def members(room_id: str, request: Request, user=Depends(current_user)):
    room, _ = await room_access(request, room_id, user)
    users = (
        await store(request)
        .db.users.find(
            {"_id": {"$in": [m["user_id"] for m in room["members"]]}},
            {"_id": 1, "display_name": 1, "username": 1},
        )
        .to_list(length=None)
    )
    lookup = {u["_id"]: u for u in users}
    return {
        "items": [
            {
                **m,
                "display_name": lookup.get(m["user_id"], {}).get("display_name", "Former member"),
                "username": lookup.get(m["user_id"], {}).get("username", ""),
            }
            for m in room["members"]
        ]
    }


@router.post("/rooms/{room_id}/invitations", status_code=201)
async def invite(room_id: str, body: Invitation, request: Request, user=Depends(current_user)):
    room, _ = await room_access(request, room_id, user, admin=True, write=True)
    await throttle(request, "invite", user["_id"], limit=30, seconds=3600)
    target = body.email_or_username.strip().lower()
    require(
        not any(
            i["email_or_username"] == target and i["status"] == "pending" and i["expires_at"] > now()
            for i in room["invitations"]
        ),
        "An active invitation already exists for this account",
        409,
    )
    invitations = [i for i in room["invitations"] if i["status"] == "pending" and i["expires_at"] > now()]
    require(len(invitations) < 100, "Too many pending invitations", 409)
    token = f"{room_id}.{secrets.token_urlsafe(32)}"
    invitation = {
        "id": uid(),
        "invited_by": user["_id"],
        "email_or_username": target,
        "role": body.role,
        "token_hash": digest(token),
        "status": "pending",
        "expires_at": now() + timedelta(days=body.expires_in_days),
        "created_at": now(),
    }
    await change_room(request, room, {"invitations": [*invitations, invitation]})
    await audit(request, user, "invitation.create", "invitation", invitation["id"], room_id)
    return {
        "id": invitation["id"],
        "token": token,
        "expires_at": invitation["expires_at"],
        "email_or_username": target,
        "message": "Share this one-time token privately with the invited account.",
    }


@router.post("/invitations/accept")
async def accept(body: AcceptInvitation, request: Request, user=Depends(current_user)):
    await throttle(request, "accept-invitation", user["_id"], limit=20, seconds=300)
    room_id = body.token.split(".")[0]
    room = await store(request).get("rooms", {"_id": room_id, "status": "active"})
    invitation = next((i for i in room["invitations"] if i["token_hash"] == digest(body.token)), None)
    require(
        invitation and invitation["status"] == "pending" and invitation["expires_at"] > now(),
        "Invitation is invalid, expired, or already accepted",
        422,
    )
    require(
        invitation["email_or_username"] in {user["username"], user.get("email")},
        "This invitation belongs to another account",
        403,
    )
    require(
        not any(m["user_id"] == user["_id"] and m["status"] == "active" for m in room["members"]),
        "You are already an active member",
        409,
    )
    require(
        len(room["members"]) < 100 or any(m["user_id"] == user["_id"] for m in room["members"]),
        "Room member limit reached",
        409,
    )
    updated = [m for m in room["members"] if m["user_id"] != user["_id"]]
    updated.append(
        {"user_id": user["_id"], "role": invitation["role"], "status": "active", "joined_at": now()}
    )
    invitation["status"], invitation["accepted_at"] = "accepted", now()
    result = await change_room(request, room, {"members": updated, "invitations": room["invitations"]})
    await audit(request, user, "invitation.accept", "invitation", invitation["id"], room_id)
    return public(result)


@router.patch("/rooms/{room_id}/members/{user_id}")
async def patch_member(
    room_id: str, user_id: str, body: MemberPatch, request: Request, user=Depends(current_user)
):
    room, _ = await room_access(request, room_id, user, admin=True, write=True)
    member = next((m for m in room["members"] if m["user_id"] == user_id), None)
    require(member)
    member.update(body.model_dump(exclude_none=True))
    require(
        any(m["role"] == "room_admin" and m["status"] == "active" for m in room["members"]),
        "The final active room administrator cannot be removed or demoted",
        409,
    )
    if member["status"] == "active":
        await store(request).get("users", {"_id": user_id, "status": "active"})
    # Historical balances remain available for departed members.
    result = await change_room(request, room, {"members": room["members"]})
    await audit(
        request, user, "membership.update", "user", user_id, room_id, body.model_dump(exclude_none=True)
    )
    return public(result)


async def category_list(request, scope_key):
    return await store(request).page("categories", {"scope_key": scope_key}, 1, 100)


async def category_create(request, body, scope, scope_key, user):
    data = {
        "scope": scope,
        "scope_key": scope_key,
        "name": body.name,
        "normalized_name": body.name.lower(),
        "icon": body.icon,
        "is_active": True,
    }
    data["room_id" if scope == "room" else "owner_user_id"] = scope_key if scope == "room" else user["_id"]
    result = await store(request).insert("categories", data)
    await audit(
        request, user, "category.create", "category", result["_id"], scope_key if scope == "room" else None
    )
    return public(result)


@router.get("/rooms/{room_id}/categories")
async def room_categories(room_id: str, request: Request, user=Depends(current_user)):
    await room_access(request, room_id, user)
    return await category_list(request, room_id)


@router.post("/rooms/{room_id}/categories", status_code=201)
async def create_category(room_id: str, body: Category, request: Request, user=Depends(current_user)):
    await room_access(request, room_id, user, admin=True, write=True)
    return await category_create(request, body, "room", room_id, user)


@router.patch("/rooms/{room_id}/categories/{category_id}")
async def patch_category(
    room_id: str, category_id: str, body: CategoryPatch, request: Request, user=Depends(current_user)
):
    await room_access(request, room_id, user, admin=True, write=True)
    changes = body.model_dump(exclude_none=True)
    if body.name:
        changes["normalized_name"] = body.name.lower()
    result = await store(request).update("categories", {"_id": category_id, "scope_key": room_id}, changes)
    await audit(request, user, "category.update", "category", category_id, room_id)
    return public(result)


@router.get("/personal/categories")
async def personal_categories(request: Request, user=Depends(current_user)):
    return await category_list(request, f"personal:{user['_id']}")


@router.post("/personal/categories", status_code=201)
async def create_personal_category(body: Category, request: Request, user=Depends(current_user)):
    result = await category_create(request, body, "personal", f"personal:{user['_id']}", user)
    return result


@router.patch("/personal/categories/{category_id}")
async def patch_personal_category(
    category_id: str, body: CategoryPatch, request: Request, user=Depends(current_user)
):
    changes = body.model_dump(exclude_none=True)
    if body.name:
        changes["normalized_name"] = body.name.lower()
    return public(
        await store(request).update(
            "categories", {"_id": category_id, "scope_key": f"personal:{user['_id']}"}, changes
        )
    )


@router.get("/rooms/{room_id}/announcements")
async def announcements(
    room_id: str,
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    include_archived: bool = False,
    user=Depends(current_user),
):
    _, member = await room_access(request, room_id, user)
    query = {"room_id": room_id}
    if not include_archived or member["role"] != "room_admin":
        query["status"] = "published"
    return await store(request).page("announcements", query, page, page_size)


@router.get("/rooms/{room_id}/announcements/unread")
async def unread_announcements(room_id: str, request: Request, user=Depends(current_user)):
    await room_access(request, room_id, user)
    query = {
        "room_id": room_id,
        "status": "published",
        "unread_user_ids": user["_id"],
    }
    collection = store(request).db.announcements
    total = await collection.count_documents(query)
    items = await collection.find(query).sort("created_at", -1).limit(20).to_list(length=20)
    return {"items": [public(item) for item in items], "total": total}


@router.post("/rooms/{room_id}/announcements/read")
async def read_announcements(
    room_id: str, body: AnnouncementRead, request: Request, user=Depends(current_user)
):
    await room_access(request, room_id, user)
    announcement_ids = list(set(body.announcement_ids))
    result = await store(request).db.announcements.update_many(
        {
            "_id": {"$in": announcement_ids},
            "room_id": room_id,
            "status": "published",
            "unread_user_ids": user["_id"],
        },
        {"$pull": {"unread_user_ids": user["_id"]}},
    )
    return {"marked_read": result.modified_count}


@router.post("/rooms/{room_id}/announcements", status_code=201)
async def announce(room_id: str, body: Announcement, request: Request, user=Depends(current_user)):
    room, _ = await room_access(request, room_id, user, write=True)
    result = await store(request).insert(
        "announcements",
        {
            **body.model_dump(),
            "room_id": room_id,
            "created_by": user["_id"],
            "status": "published",
            "published_at": now(),
            "unread_user_ids": [
                member["user_id"]
                for member in room["members"]
                if member["status"] == "active" and member["user_id"] != user["_id"]
            ],
        },
    )
    await audit(request, user, "announcement.create", "announcement", result["_id"], room_id)
    return public(result)


@router.patch("/rooms/{room_id}/announcements/{announcement_id}")
async def patch_announcement(
    room_id: str, announcement_id: str, body: AnnouncementPatch, request: Request, user=Depends(current_user)
):
    await room_access(request, room_id, user, admin=True, write=True)
    result = await store(request).update(
        "announcements", {"_id": announcement_id, "room_id": room_id}, body.model_dump(exclude_none=True)
    )
    await audit(request, user, "announcement.update", "announcement", announcement_id, room_id)
    return public(result)
