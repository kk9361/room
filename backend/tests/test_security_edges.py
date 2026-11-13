from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta

from app.core.security import now, verify_password
from conftest import headers, login
from test_workflows import make_expense


def db_call(client, fn):
    return client.portal.call(fn)


def test_password_hash_and_password_change_revocation(client):
    async def read():
        return await client.app.state.db.users.find_one({"username": "admin"})

    user = db_call(client, read)
    assert user["password_hash"].startswith("$argon2id$")
    assert verify_password("TemporaryAdmin!123", user["password_hash"])
    old = login(client, "admin", "TemporaryAdmin!123")
    current = login(client, "admin", "TemporaryAdmin!123")
    changed = client.post(
        "/api/v1/auth/change-password",
        json={
            "current_password": "TemporaryAdmin!123",
            "new_password": "DifferentPassword!123",
            "client": "mobile",
        },
        headers=headers(current),
    )
    assert changed.status_code == 200 and changed.json()["refresh_token"]
    assert client.get("/api/v1/auth/me", headers=headers(old)).status_code == 401
    assert client.get("/api/v1/auth/me", headers=headers(changed.json())).status_code == 200


def test_expired_invitation_is_rejected(client, household):
    room, people = household
    invitation = client.post(
        f"/api/v1/rooms/{room['id']}/invitations",
        headers=headers(people[0]),
        json={"email_or_username": "outsider"},
    ).json()

    async def expire():
        doc = await client.app.state.db.rooms.find_one({"_id": room["id"]})
        for item in doc["invitations"]:
            item["expires_at"] = now() - timedelta(days=1)
        await client.app.state.db.rooms.update_one(
            {"_id": room["id"]}, {"$set": {"invitations": doc["invitations"]}}
        )

    db_call(client, expire)
    assert (
        client.post(
            "/api/v1/invitations/accept", json={"token": invitation["token"]}, headers=headers(people[3])
        ).status_code
        == 422
    )


def test_concurrent_financial_submissions_create_one_record(client, household):
    room, people = household
    with ThreadPoolExecutor(max_workers=6) as pool:
        results = list(
            pool.map(lambda _: make_expense(client, room, people, key="concurrent-expense-key"), range(12))
        )
    assert all(x.status_code in (200, 201) for x in results), [x.text for x in results]
    assert len({x.json()["id"] for x in results}) == 1
    result = client.get(f"/api/v1/rooms/{room['id']}/expenses", headers=headers(people[0]))
    assert result.json()["total"] == 1


def test_exact_percentage_and_nonparticipant_payer(client, household):
    room, people = household
    ids = [p["user"]["id"] for p in people[1:3]]
    exact = make_expense(
        client,
        room,
        people,
        key="exact-expense-key",
        total_paise=101,
        participants=ids,
        split_type="exact",
        shares=[{"user_id": ids[0], "share_paise": 50}, {"user_id": ids[1], "share_paise": 51}],
    )
    assert exact.status_code == 201
    percentage = make_expense(
        client,
        room,
        people,
        key="percent-expense-key",
        total_paise=101,
        participants=ids,
        split_type="percentage",
        percentages=[{"user_id": ids[0], "basis_points": 5000}, {"user_id": ids[1], "basis_points": 5000}],
    )
    assert percentage.status_code == 201
    assert sum(x["share_paise"] for x in percentage.json()["splits"]) == 101
    balances = client.get(f"/api/v1/rooms/{room['id']}/balances", headers=headers(people[0])).json()
    assert balances["items"][0]["net_paise"] == 202
    assert sum(x["net_paise"] for x in balances["items"]) == 0


def test_settlement_reject_cancel_and_duplicate_key(client, household):
    room, people = household
    root = f"/api/v1/rooms/{room['id']}"
    data = {
        "from_user_id": people[1]["user"]["id"],
        "to_user_id": people[0]["user"]["id"],
        "amount_paise": 100,
    }
    key = {**headers(people[1]), "Idempotency-Key": "settlement-repeat-key"}
    one = client.post(root + "/settlements", json=data, headers=key)
    two = client.post(root + "/settlements", json=data, headers=key)
    assert one.status_code == 201 and two.status_code == 200 and one.json()["id"] == two.json()["id"]
    assert (
        client.post(root + "/settlements", json={**data, "amount_paise": 200}, headers=key).status_code == 409
    )
    path = root + "/settlements/" + one.json()["id"]
    assert client.post(path + "/reject", headers=headers(people[0])).status_code == 200
    assert client.post(path + "/confirm", headers=headers(people[0])).status_code == 409
    next_settlement = client.post(
        root + "/settlements",
        json=data,
        headers={**headers(people[1]), "Idempotency-Key": "settlement-cancel-key"},
    ).json()
    assert (
        client.post(
            root + "/settlements/" + next_settlement["id"] + "/cancel", headers=headers(people[1])
        ).status_code
        == 200
    )
    assert all(
        x["net_paise"] == 0
        for x in client.get(root + "/balances", headers=headers(people[0])).json()["items"]
    )


def test_category_scope_announcements_and_platform_privacy(client, household):
    room, people = household
    category = client.post(
        "/api/v1/personal/categories", headers=headers(people[0]), json={"name": "Private"}
    ).json()
    assert make_expense(client, room, people, category_id=category["id"]).status_code == 404
    root = f"/api/v1/rooms/{room['id']}"
    member_post = client.post(
        root + "/announcements",
        json={"title": "Hi", "body": "Hello"},
        headers=headers(people[1]),
    )
    assert member_post.status_code == 201, member_post.text
    member_post = member_post.json()
    assert "unread_user_ids" not in member_post
    assert client.get(root + "/announcements/unread", headers=headers(people[1])).json()["total"] == 0
    admin_notifications = client.get(root + "/announcements/unread", headers=headers(people[0])).json()
    assert admin_notifications["total"] == 1
    assert admin_notifications["items"][0]["id"] == member_post["id"]
    chris_notifications = client.get(root + "/announcements/unread", headers=headers(people[2])).json()
    assert chris_notifications["total"] == 1
    assert client.get(root + "/announcements/unread", headers=headers(people[3])).status_code == 404
    read = client.post(
        root + "/announcements/read",
        json={"announcement_ids": [member_post["id"]]},
        headers=headers(people[2]),
    )
    assert read.status_code == 200 and read.json()["marked_read"] == 1
    assert client.get(root + "/announcements/unread", headers=headers(people[2])).json()["total"] == 0
    assert client.get(root + "/announcements/unread", headers=headers(people[0])).json()["total"] == 1

    announcement = client.post(
        root + "/announcements", json={"title": "House meeting", "body": "Sunday"}, headers=headers(people[0])
    ).json()
    assert client.get(root + "/announcements", headers=headers(people[1])).json()["total"] == 2
    bob_notifications = client.get(root + "/announcements/unread", headers=headers(people[1])).json()
    assert bob_notifications["total"] == 1
    assert bob_notifications["items"][0]["id"] == announcement["id"]
    assert (
        client.patch(
            root + "/announcements/" + announcement["id"],
            json={"status": "archived"},
            headers=headers(people[0]),
        ).status_code
        == 200
    )
    assert client.get(root + "/announcements", headers=headers(people[1])).json()["total"] == 1
    client.post(
        "/api/v1/personal/expenses",
        headers=headers(people[1]),
        json={"expense_date": "2026-11-09", "description": "TOP_SECRET_PURCHASE", "amount_paise": 123},
    )
    audit = client.get("/api/v1/admin/audit-logs?page_size=100", headers=headers(people[0]))
    assert audit.status_code == 200 and "TOP_SECRET_PURCHASE" not in audit.text
    assert "password_hash" not in client.get("/api/v1/admin/users", headers=headers(people[0])).text


def test_login_throttling_and_recovery_disabled(client):
    for _ in range(10):
        assert (
            client.post("/api/v1/auth/login", json={"identifier": "nobody", "password": "bad"}).status_code
            == 401
        )
    assert (
        client.post("/api/v1/auth/login", json={"identifier": "nobody", "password": "bad"}).status_code == 429
    )
    assert client.post("/api/v1/auth/forgot-password").status_code == 503


def test_kolkata_report_boundaries(client, household):
    room, people = household
    root = f"/api/v1/rooms/{room['id']}"

    # October 31 19:00 UTC is November 1 00:30 in Kolkata.
    async def insert():
        await client.app.state.db.settlements.insert_one(
            {
                "_id": "boundary-settlement",
                "room_id": room["id"],
                "from_user_id": people[1]["user"]["id"],
                "to_user_id": people[0]["user"]["id"],
                "amount_paise": 123,
                "status": "completed",
                "idempotency_key": "boundary-test-key",
                "completed_at": datetime(2026, 10, 31, 19, 0, tzinfo=UTC),
                "created_at": now(),
            }
        )

    db_call(client, insert)
    report = client.get(root + "/reports/monthly?year=2026&month=11", headers=headers(people[0])).json()
    assert report["member_totals"][1]["settlements_paid_paise"] == 123
    october = client.get(root + "/reports/monthly?year=2026&month=10", headers=headers(people[0])).json()
    assert october["member_totals"][1]["settlements_paid_paise"] == 0


def test_platform_clear_data_requires_admin_password_and_confirmation(client, household):
    room, people = household
    path = "/api/v1/admin/clear-data"
    payload = {"confirmation": "CLEAR ALL DATA", "current_password": "NewAdminPassword!123"}

    denied = client.post(path, json=payload, headers=headers(people[1]))
    assert denied.status_code == 403

    wrong_phrase = client.post(
        path,
        json={"confirmation": "clear everything", "current_password": payload["current_password"]},
        headers=headers(people[0]),
    )
    assert wrong_phrase.status_code == 422

    wrong_password = client.post(
        path,
        json={"confirmation": payload["confirmation"], "current_password": "WrongPassword!123"},
        headers=headers(people[0]),
    )
    assert wrong_password.status_code == 422
    assert client.get("/api/v1/rooms", headers=headers(people[0])).status_code == 200

    result = client.post(path, json=payload, headers=headers(people[0]))
    assert result.status_code == 200, result.text
    report = result.json()
    assert report["total_deleted"] > 0
    assert report["database_empty"] is True
    assert {"rooms", "users", "sessions", "audit_logs"}.issubset(report["deleted_counts"])

    async def inspect_empty_database():
        db = client.app.state.db
        return {
            name: await db[name].count_documents({})
            for name in await db.list_collection_names()
            if not name.startswith("system.")
        }

    assert all(count == 0 for count in db_call(client, inspect_empty_database).values())
    assert client.get("/api/v1/auth/me", headers=headers(people[0])).status_code == 401
