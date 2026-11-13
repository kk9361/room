import os
import secrets

import pytest
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient

os.environ.setdefault("JWT_SECRET", "testing-only-secret-with-at-least-32-characters")
from app.core.config import Settings
from app.main import create_app


@pytest.fixture
def client(request):
    uri = os.environ.get("TEST_MONGODB_URI")
    database_name = "test_roommate_" + secrets.token_hex(6)
    options = dict(
        _env_file=None,
        jwt_secret="testing-only-secret-with-at-least-32-characters",
        bootstrap_username="admin",
        bootstrap_password="TemporaryAdmin!123",
        mongodb_uri=uri or "mongodb://localhost:27017",
        mongodb_database=database_name,
    )
    options.update(getattr(request, "param", {}))
    config = Settings(**options)
    database = None if uri else AsyncMongoMockClient(tz_aware=True)["test_ledger"]
    base_url = "https://testserver" if config.cookie_secure else "http://testserver"
    with TestClient(create_app(config, database), base_url=base_url) as test:
        yield test
    if uri:
        from pymongo import MongoClient

        with MongoClient(uri) as cleanup:
            assert database_name.startswith("test_roommate_")
            cleanup.drop_database(database_name)


def login(client, identifier, password):
    result = client.post(
        "/api/v1/auth/login", json={"identifier": identifier, "password": password, "client": "mobile"}
    )
    assert result.status_code == 200, result.text
    return result.json()


def headers(tokens):
    return {"Authorization": f"Bearer {tokens['access_token']}"}


@pytest.fixture
def household(client):
    admin = login(client, "admin", "TemporaryAdmin!123")
    result = client.post(
        "/api/v1/auth/change-password",
        headers=headers(admin),
        json={"current_password": "TemporaryAdmin!123", "new_password": "NewAdminPassword!123"},
    )
    assert result.status_code == 200, result.text
    admin = result.json()
    people = [admin]
    for username in ("bob", "chris", "outsider"):
        result = client.post(
            "/api/v1/auth/register",
            json={"username": username, "display_name": username.title(), "password": "MemberPassword!123"},
        )
        assert result.status_code == 201, result.text
        people.append(login(client, username, "MemberPassword!123"))
    room_result = client.post("/api/v1/rooms", headers=headers(admin), json={"name": "Test Household"})
    assert room_result.status_code == 201, room_result.text
    room = room_result.json()
    for person in people[1:3]:
        invitation = client.post(
            f"/api/v1/rooms/{room['id']}/invitations",
            headers=headers(admin),
            json={"email_or_username": person["user"]["username"]},
        ).json()
        result = client.post(
            "/api/v1/invitations/accept", headers=headers(person), json={"token": invitation["token"]}
        )
        assert result.status_code == 200, result.text
    return room, people
