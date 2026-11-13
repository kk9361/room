from fastapi import APIRouter, Depends, Request, Response

from app.core.errors import DomainError, require
from app.core.security import now, password_hash, verify_password
from app.repositories.store import public
from app.schemas.requests import Login, PasswordChange, Profile, Refresh, Register
from app.services.auth import current_user, new_session, rotate
from app.services.context import audit, store, throttle

router = APIRouter(tags=["Authentication"])
DUMMY_HASH = password_hash("not-an-actual-user-password")


@router.post("/auth/register", status_code=201)
async def register(body: Register, request: Request):
    await throttle(request, "register", limit=5, seconds=300)
    data = body.model_dump(exclude={"password", "email"})
    data["username"] = body.username.lower()
    if body.email:
        data["email"] = body.email
    user = await store(request).insert(
        "users",
        {
            **data,
            "password_hash": password_hash(body.password),
            "platform_role": "user",
            "status": "active",
            "must_change_password": False,
            "auth_version": 0,
        },
    )
    await audit(request, user, "user.register", "user", user["_id"])
    return public(user)


@router.post("/auth/login")
async def login(body: Login, request: Request, response: Response):
    await throttle(request, "login-ip", limit=30, seconds=300)
    await throttle(request, "login", body.identifier, limit=10, seconds=300)
    user = await store(request).db.users.find_one(
        {"$or": [{"username": body.identifier.lower()}, {"email": body.identifier.lower()}]}
    )
    valid = verify_password(body.password, user["password_hash"] if user else DUMMY_HASH)
    if not (valid and user and user["status"] == "active"):
        await audit(request, None, "auth.login_failed", "user", "unknown")
        raise DomainError(401, "Invalid username/email or password", "INVALID_CREDENTIALS")
    await store(request).db.users.update_one({"_id": user["_id"]}, {"$set": {"last_login_at": now()}})
    await audit(request, user, "auth.login", "user", user["_id"])
    return await new_session(request, response, user, body.device_label, body.client)


@router.post("/auth/refresh")
async def refresh(body: Refresh, request: Request, response: Response):
    await throttle(request, "refresh", limit=100, seconds=60)
    return await rotate(
        request, response, body.refresh_token or request.cookies.get("roommate_refresh"), body.client
    )


@router.post("/auth/logout")
async def logout(request: Request, response: Response, user=Depends(current_user)):
    await store(request).db.sessions.update_one(
        {"_id": request.state.session_id}, {"$set": {"revoked": True}}
    )
    response.delete_cookie("roommate_refresh", path="/api/v1/auth")
    await audit(request, user, "auth.logout", "user", user["_id"])
    return {"message": "Signed out"}


@router.post("/auth/change-password")
async def change_password(
    body: PasswordChange, request: Request, response: Response, user=Depends(current_user)
):
    await throttle(request, "password-change", user["_id"], limit=10, seconds=300)
    require(
        verify_password(body.current_password, user["password_hash"]), "Current password is incorrect", 422
    )
    require(body.current_password != body.new_password, "New password must be different", 422)
    db = store(request).db
    updated = await store(request).update(
        "users",
        {"_id": user["_id"], "password_hash": user["password_hash"]},
        {
            "password_hash": password_hash(body.new_password),
            "must_change_password": False,
            "auth_version": user.get("auth_version", 0) + 1,
        },
    )
    await db.sessions.update_many({"user_id": user["_id"]}, {"$set": {"revoked": True}})
    await audit(request, user, "auth.password_changed", "user", user["_id"])
    return await new_session(request, response, updated, "Password change", body.client)


@router.get("/auth/me")
@router.get("/users/me")
async def me(request: Request, user=Depends(current_user)):
    memberships = (
        await store(request)
        .db.rooms.find(
            {"members": {"$elemMatch": {"user_id": user["_id"], "status": "active"}}},
            {"name": 1, "members": 1, "status": 1},
        )
        .to_list(length=None)
    )
    return {
        **public(user),
        "memberships": [
            {
                "room_id": r["_id"],
                "name": r["name"],
                "status": r["status"],
                "role": next(m["role"] for m in r["members"] if m["user_id"] == user["_id"]),
            }
            for r in memberships
        ],
    }


@router.patch("/users/me")
async def profile(body: Profile, request: Request, user=Depends(current_user)):
    return public(await store(request).update("users", {"_id": user["_id"]}, body.model_dump()))


@router.post("/auth/forgot-password")
@router.post("/auth/reset-password")
async def reset_disabled():
    raise DomainError(
        503, "Email recovery is not configured. Contact your platform administrator.", "RECOVERY_DISABLED"
    )
