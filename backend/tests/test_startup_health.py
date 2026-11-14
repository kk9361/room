import json
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient
from pymongo.errors import OperationFailure, ServerSelectionTimeoutError

from app.core.config import Settings
from app.main import create_app

PRIVATE_TEXT = "a-private-password-and-connection-string-that-must-not-be-logged"


@pytest.mark.parametrize(
    "stage,exc,expected_action,expected_code",
    [
        ("database_connection", OperationFailure(PRIVATE_TEXT, code=8000), "check_atlas_database_user_credentials", 8000),
        ("database_connection", ServerSelectionTimeoutError(PRIVATE_TEXT), "check_atlas_network_access_dns_tls", None),
        ("indexes", OperationFailure(PRIVATE_TEXT, code=13), "check_database_user_permissions", 13),
        ("indexes", OperationFailure(PRIVATE_TEXT, code=85), "check_database_indexes_and_duplicate_records", 85),
        ("bootstrap", ValueError(PRIVATE_TEXT), "check_bootstrap_configuration", None),
    ],
)
def test_failed_database_startup_stays_unready_and_logs_safe_diagnostics(monkeypatch, caplog, stage, exc, expected_action, expected_code):
    config = Settings(
        _env_file=None,
        app_env="test",
        mongodb_uri="mongodb://127.0.0.1:27017",
        mongodb_database="test_startup_failure",
        jwt_secret="testing-only-secret-with-at-least-32-characters",
    )
    db = MagicMock()
    db.command = AsyncMock(return_value={"ok": 1})
    connection = MagicMock()
    connection.__getitem__.return_value = db
    connection.close = AsyncMock()
    indexes = AsyncMock()
    bootstrap = AsyncMock()
    if stage == "database_connection":
        db.command.side_effect = exc
    elif stage == "indexes":
        indexes.side_effect = exc
    else:
        bootstrap.side_effect = exc
    monkeypatch.setattr("app.main.client_for", lambda _: connection)
    monkeypatch.setattr("app.main.indexes", indexes)
    monkeypatch.setattr("app.main.bootstrap", bootstrap)
    with TestClient(create_app(config)) as client:
        assert client.get("/api/v1/health").status_code == 200
        response = client.get("/api/v1/health/ready")
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "NOT_READY"
    events = [json.loads(record.message) for record in caplog.records if '"event": "database_unavailable"' in record.message]
    assert len(events) == 1
    assert events[0]["stage"] == stage
    assert events[0]["error_type"] == type(exc).__name__
    assert events[0]["code"] == expected_code
    assert events[0]["action"] == expected_action
    assert PRIVATE_TEXT not in caplog.text
    connection.close.assert_awaited_once()
