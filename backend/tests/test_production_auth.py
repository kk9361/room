import pytest
from pydantic import ValidationError

from app.core.config import Settings

ORIGIN = "https://room-six-murex.vercel.app"


@pytest.mark.parametrize(
    "client",
    [{"app_env": "production", "cookie_secure": True, "cookie_samesite": "none", "cors_origins": ORIGIN}],
    indirect=True,
)
def test_cross_origin_web_authentication_and_logout(client):
    assert client.get("/api/v1/health/ready").status_code == 200
    schema = client.get("/openapi.json").json()
    assert schema["info"]["title"] == "RoomMate Ledger API"
    assert "post" in schema["paths"]["/api/v1/auth/login"]
    preflight = client.options(
        "/api/v1/auth/login",
        headers={
            "Origin": ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,authorization",
        },
    )
    assert preflight.status_code == 200
    assert preflight.headers["access-control-allow-origin"] == ORIGIN
    assert preflight.headers["access-control-allow-credentials"] == "true"
    data = {"identifier": "admin", "password": "TemporaryAdmin!123"}
    assert client.post(
        "/api/v1/auth/login", json=data, headers={"Origin": "https://untrusted.example"}
    ).status_code == 403
    invalid = client.post(
        "/api/v1/auth/login", json={**data, "password": "InvalidPassword!123"}, headers={"Origin": ORIGIN}
    )
    assert invalid.status_code == 401
    assert invalid.json()["error"]["code"] == "INVALID_CREDENTIALS"
    assert invalid.headers["access-control-allow-origin"] == ORIGIN
    signed_in = client.post("/api/v1/auth/login", json=data, headers={"Origin": ORIGIN})
    assert signed_in.status_code == 200
    assert "refresh_token" not in signed_in.json()
    cookie = signed_in.headers["set-cookie"].lower()
    assert all(part in cookie for part in ["httponly", "secure", "samesite=none", "path=/api/v1/auth"])
    bearer = {"Authorization": "Bearer " + signed_in.json()["access_token"]}
    assert client.get("/api/v1/auth/me", headers=bearer).status_code == 200
    assert client.get("/api/v1/auth/me").status_code == 401
    assert client.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalid.jwt.token"}).status_code == 401
    refreshed = client.post("/api/v1/auth/refresh", json={}, headers={"Origin": ORIGIN})
    assert refreshed.status_code == 200
    logout = client.post("/api/v1/auth/logout", headers={**bearer, "Origin": ORIGIN})
    assert logout.status_code == 200
    assert "samesite=none" in logout.headers["set-cookie"].lower()
    assert client.get("/api/v1/auth/me", headers=bearer).status_code == 401
    assert client.post("/api/v1/auth/refresh", json={}, headers={"Origin": ORIGIN}).status_code == 401


def test_insecure_cross_site_cookies_are_rejected():
    with pytest.raises(ValidationError, match="Cross-site cookies require COOKIE_SECURE=true"):
        Settings(
            _env_file=None,
            app_env="development",
            jwt_secret="test-only-secret-with-at-least-32-characters",
            cookie_secure=False,
            cookie_samesite="none",
        )
