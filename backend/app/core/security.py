import hashlib
import secrets
from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

hasher = PasswordHasher()


def now():
    return datetime.now(UTC)


def uid():
    return secrets.token_hex(12)


def digest(value: str):
    return hashlib.sha256(value.encode()).hexdigest()


def password_hash(password: str):
    return hasher.hash(password)


def verify_password(password: str, hashed: str):
    try:
        return hasher.verify(hashed, password)
    except (VerificationError, InvalidHashError):
        return False


def access_token(user, session_id, settings):
    return jwt.encode(
        {
            "sub": user["_id"],
            "sid": session_id,
            "ver": user.get("auth_version", 0),
            "iss": "roommate-ledger",
            "aud": "roommate-clients",
            "iat": now(),
            "exp": now() + timedelta(minutes=settings.access_token_minutes),
        },
        settings.jwt_secret.get_secret_value(),
        algorithm="HS256",
    )


def decode_token(token, settings):
    return jwt.decode(
        token,
        settings.jwt_secret.get_secret_value(),
        algorithms=["HS256"],
        issuer="roommate-ledger",
        audience="roommate-clients",
        options={"require": ["exp", "iat", "sub", "sid", "ver"]},
    )
