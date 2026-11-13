import secrets
from datetime import timedelta

from fastapi import Depends, Request, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError
from pymongo import ReturnDocument

from app.core.errors import DomainError, require
from app.core.security import access_token, decode_token, digest, now, uid
from app.repositories.store import public
from app.services.context import store

bearer = HTTPBearer(auto_error=False)


async def current_user(request: Request, credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
    require(credentials and credentials.scheme.lower() == "bearer", "Sign in required", 401, "UNAUTHORIZED")
    try:
        claims = decode_token(credentials.credentials, request.app.state.settings)
    except InvalidTokenError:
        raise DomainError(401, "Session expired. Please sign in again.", "UNAUTHORIZED")
    db = store(request).db
    user = await db.users.find_one({"_id": claims["sub"], "status": "active", "auth_version": claims["ver"]})
    session = await db.sessions.find_one(
        {"_id": claims["sid"], "user_id": claims["sub"], "revoked": False, "expires_at": {"$gt": now()}}
    )
    require(user and session, "Session expired. Please sign in again.", 401, "UNAUTHORIZED")
    allowed = ("/auth/me", "/users/me", "/auth/change-password", "/auth/logout")
    require(
        not user.get("must_change_password") or request.url.path.endswith(allowed),
        "Change your temporary password before continuing",
        403,
        "PASSWORD_CHANGE_REQUIRED",
    )
    request.state.session_id = claims["sid"]
    return user


async def platform_admin(user=Depends(current_user)):
    require(user.get("platform_role") == "super_admin", "Platform administrator access required", 403)
    return user


def token_response(response: Response, user, session_id, token, settings, client="web"):
    response.headers["Cache-Control"] = "no-store"
    result = {
        "access_token": access_token(user, session_id, settings),
        "token_type": "bearer",
        "expires_in": settings.access_token_minutes * 60,
        "user": public(user),
    }
    if client == "mobile":
        result["refresh_token"] = token
    else:
        response.set_cookie(
            "roommate_refresh",
            token,
            httponly=True,
            secure=settings.cookie_secure,
            samesite=settings.cookie_samesite,
            path="/api/v1/auth",
            max_age=settings.refresh_token_days * 86400,
        )
    return result


async def new_session(request, response, user, device_label, client):
    session_id = uid()
    token = f"{session_id}.{secrets.token_urlsafe(48)}"
    await store(request).insert(
        "sessions",
        {
            "_id": session_id,
            "user_id": user["_id"],
            "token_hash": digest(token),
            "used_hashes": [],
            "revoked": False,
            "device_label": device_label,
            "expires_at": now() + timedelta(days=request.app.state.settings.refresh_token_days),
        },
    )
    return token_response(response, user, session_id, token, request.app.state.settings, client)


async def rotate(request, response, token, client):
    require(token and "." in token, "Refresh token required", 401)
    session_id = token.split(".")[0]
    db = store(request).db
    session = await db.sessions.find_one({"_id": session_id, "revoked": False, "expires_at": {"$gt": now()}})
    require(session, "Session expired. Please sign in again.", 401, "UNAUTHORIZED")
    hashed = digest(token)
    if hashed in session["used_hashes"]:
        await db.sessions.update_one({"_id": session_id}, {"$set": {"revoked": True}})
        raise DomainError(401, "Refresh token reuse detected. Please sign in again.", "TOKEN_REUSE")
    require(session["token_hash"] == hashed, "Invalid refresh token", 401)
    user = await db.users.find_one({"_id": session["user_id"], "status": "active"})
    require(user, "Session expired. Please sign in again.", 401)
    new_token = f"{session_id}.{secrets.token_urlsafe(48)}"
    updated = await db.sessions.find_one_and_update(
        {"_id": session_id, "token_hash": hashed, "revoked": False},
        {"$set": {"token_hash": digest(new_token)}, "$push": {"used_hashes": hashed}},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        await db.sessions.update_one({"_id": session_id}, {"$set": {"revoked": True}})
        raise DomainError(401, "Refresh token already used. Please sign in again.", "TOKEN_REUSE")
    return token_response(response, user, session_id, new_token, request.app.state.settings, client)
