from conftest import headers, login


def make_expense(client, room, people, key="expense-key-001", **changes):
    body = {
        "expense_date": "2026-11-09",
        "description": "Groceries",
        "total_paise": 90000,
        "paid_by": people[0]["user"]["id"],
        "participants": [p["user"]["id"] for p in people[:3]],
        "split_type": "equal",
        **changes,
    }
    return client.post(
        f"/api/v1/rooms/{room['id']}/expenses",
        json=body,
        headers={**headers(people[0]), "Idempotency-Key": key},
    )


def test_health_bootstrap_and_forced_password(client):
    assert client.get("/api/v1/health").status_code == 200
    assert client.get("/api/v1/health/ready").status_code == 200
    tokens = login(client, "admin", "TemporaryAdmin!123")
    assert tokens["user"]["must_change_password"] is True
    assert "password_hash" not in tokens["user"]
    assert client.get("/api/v1/rooms", headers=headers(tokens)).status_code == 403
    assert client.get("/api/v1/auth/me", headers=headers(tokens)).status_code == 200
    assert client.get("/api/v1/rooms").status_code == 401
    assert (
        client.post("/api/v1/auth/login", json={"identifier": "admin", "password": "wrong"}).status_code
        == 401
    )


def test_refresh_rotation_reuse_and_logout(client):
    tokens = login(client, "admin", "TemporaryAdmin!123")
    rotated = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"], "client": "mobile"}
    )
    assert rotated.status_code == 200
    assert rotated.json()["refresh_token"] != tokens["refresh_token"]
    replay = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"], "client": "mobile"}
    )
    assert replay.status_code == 401
    assert client.get("/api/v1/auth/me", headers=headers(rotated.json())).status_code == 401
    tokens = login(client, "admin", "TemporaryAdmin!123")
    assert client.post("/api/v1/auth/logout", headers=headers(tokens)).status_code == 200
    assert client.get("/api/v1/auth/me", headers=headers(tokens)).status_code == 401


def test_full_financial_flow_and_reports(client, household):
    room, people = household
    root = f"/api/v1/rooms/{room['id']}"
    result = make_expense(client, room, people)
    assert result.status_code == 201, result.text
    assert sum(x["share_paise"] for x in result.json()["splits"]) == 90000
    net = client.get(root + "/balances", headers=headers(people[0])).json()
    assert net["reconciled"]
    assert [x["net_paise"] for x in net["items"]] == [60000, -30000, -30000]
    report = client.get(root + "/reports/monthly?year=2026&month=11", headers=headers(people[1])).json()
    assert report["total_paise"] == 90000
    for i, sender in enumerate(people[1:3]):
        transfer = client.post(
            root + "/settlements",
            json={
                "from_user_id": sender["user"]["id"],
                "to_user_id": people[0]["user"]["id"],
                "amount_paise": 30000,
            },
            headers={**headers(sender), "Idempotency-Key": f"settlement-key-{i}"},
        )
        assert transfer.status_code == 201, transfer.text
        settlement_id = transfer.json()["id"]
        before = client.get(root + "/balances", headers=headers(sender)).json()["items"]
        assert next(x for x in before if x["user_id"] == sender["user"]["id"])["net_paise"] == -30000
        assert (
            client.post(root + f"/settlements/{settlement_id}/confirm", headers=headers(sender)).status_code
            == 403
        )
        assert (
            client.post(
                root + f"/settlements/{settlement_id}/confirm", headers=headers(people[0])
            ).status_code
            == 200
        )
        assert (
            client.post(
                root + f"/settlements/{settlement_id}/confirm", headers=headers(people[0])
            ).status_code
            == 200
        )
    net = client.get(root + "/balances", headers=headers(people[0])).json()
    assert all(x["net_paise"] == 0 for x in net["items"])


def test_idempotency_and_immutable_reversal(client, household):
    room, people = household
    one = make_expense(client, room, people)
    two = make_expense(client, room, people)
    assert one.status_code == 201 and two.status_code == 200
    assert one.json()["id"] == two.json()["id"]
    assert make_expense(client, room, people, total_paise=100).status_code == 409
    root = f"/api/v1/rooms/{room['id']}"
    endpoint = root + f"/expenses/{one.json()['id']}"
    assert client.patch(endpoint, json={"total_paise": 100}, headers=headers(people[0])).status_code == 405
    assert (
        client.post(
            endpoint + "/reverse", json={"reason": "Wrong receipt"}, headers=headers(people[1])
        ).status_code
        == 403
    )
    result = client.post(endpoint + "/reverse", json={"reason": "Wrong receipt"}, headers=headers(people[0]))
    assert result.status_code == 200, result.text
    assert all(
        x["net_paise"] == 0
        for x in client.get(root + "/balances", headers=headers(people[0])).json()["items"]
    )
    assert (
        client.get(root + "/reports/monthly?year=2026&month=11", headers=headers(people[0])).json()[
            "total_paise"
        ]
        == 0
    )


def test_personal_privacy_crud_and_reports(client, household):
    room, people = household
    body = {"expense_date": "2026-11-09", "description": "Private purchase", "amount_paise": 5000}
    result = client.post("/api/v1/personal/expenses", json=body, headers=headers(people[1]))
    assert result.status_code == 201
    expense_id = result.json()["id"]
    for other in [people[0], people[2], people[3]]:
        assert client.get("/api/v1/personal/expenses", headers=headers(other)).json()["total"] == 0
        for method in ("get", "patch", "delete"):
            kwargs = {"headers": headers(other)}
            if method == "patch":
                kwargs["json"] = {"description": "Stolen"}
            assert (
                getattr(client, method)(f"/api/v1/personal/expenses/{expense_id}", **kwargs).status_code
                == 404
            )
    report = client.get(
        "/api/v1/personal/reports/monthly?year=2026&month=11", headers=headers(people[1])
    ).json()
    assert report["total_paise"] == 5000
    assert (
        client.get(f"/api/v1/rooms/{room['id']}/balances", headers=headers(people[0])).json()[
            "total_shared_paise"
        ]
        == 0
    )
    assert (
        client.patch(
            f"/api/v1/personal/expenses/{expense_id}", json={"amount_paise": 1234}, headers=headers(people[1])
        ).status_code
        == 200
    )
    assert (
        client.delete(f"/api/v1/personal/expenses/{expense_id}", headers=headers(people[1])).status_code
        == 200
    )
    assert client.get("/api/v1/personal/expenses", headers=headers(people[1])).json()["total"] == 0


def test_authorization_last_admin_and_outsider(client, household):
    room, people = household
    root = f"/api/v1/rooms/{room['id']}"
    assert client.get(root, headers=headers(people[3])).status_code == 404
    assert (
        client.post(
            root + "/invitations", json={"email_or_username": "someone"}, headers=headers(people[1])
        ).status_code
        == 403
    )
    assert (
        client.patch(
            root + f"/members/{people[0]['user']['id']}",
            json={"role": "room_member"},
            headers=headers(people[0]),
        ).status_code
        == 409
    )
    assert client.get("/api/v1/admin/users", headers=headers(people[1])).status_code == 403
    result = make_expense(client, room, people, participants=[people[3]["user"]["id"]])
    assert result.status_code == 422
    assert client.patch(root, json={"status": "archived"}, headers=headers(people[0])).status_code == 200
    assert make_expense(client, room, people).status_code == 409


def test_invitation_recipient_and_reuse(client, household):
    room, people = household
    root = f"/api/v1/rooms/{room['id']}"
    invitation = client.post(
        root + "/invitations", json={"email_or_username": "outsider"}, headers=headers(people[0])
    ).json()
    assert (
        client.post(
            "/api/v1/invitations/accept", json={"token": invitation["token"]}, headers=headers(people[1])
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/v1/invitations/accept", json={"token": invitation["token"]}, headers=headers(people[3])
        ).status_code
        == 200
    )
    assert (
        client.post(
            "/api/v1/invitations/accept", json={"token": invitation["token"]}, headers=headers(people[3])
        ).status_code
        == 422
    )


def test_search_filters_pagination_and_csv_safety(client, household):
    room, people = household
    make_expense(client, room, people, description='=HYPERLINK("bad")')
    root = f"/api/v1/rooms/{room['id']}"
    result = client.get(root + "/expenses?search=HYPERLINK&page_size=1", headers=headers(people[0])).json()
    assert result["total"] == 1 and len(result["items"]) == 1
    assert client.get(root + "/expenses?page_size=101", headers=headers(people[0])).status_code == 422
    assert (
        client.get(root + "/expenses?from=2026-12-01&to=2026-11-01", headers=headers(people[0])).status_code
        == 422
    )
    export = client.get(root + "/reports/export", headers=headers(people[0]))
    assert export.status_code == 200 and "'=HYPERLINK" in export.text


def test_integer_only_money(client, household):
    room, people = household
    for invalid in (True, 10.1, "100", -1, 0):
        assert make_expense(client, room, people, total_paise=invalid).status_code == 422


def test_cookie_and_error_hygiene(client):
    result = client.post("/api/v1/auth/login", json={"identifier": "admin", "password": "TemporaryAdmin!123"})
    assert "HttpOnly" in result.headers["set-cookie"] and "SameSite=strict" in result.headers["set-cookie"]
    assert "refresh_token" not in result.json()
    result = client.post(
        "/api/v1/auth/login", json={"identifier": "admin", "password": "SENSITIVE", "unexpected": True}
    )
    assert result.status_code == 422 and "SENSITIVE" not in result.text
    assert result.json()["error"]["request_id"]
    assert (
        client.post("/api/v1/auth/refresh", headers={"Origin": "https://evil.example"}, json={}).status_code
        == 403
    )
