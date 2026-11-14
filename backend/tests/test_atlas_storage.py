import pytest
from pydantic import ValidationError

from app.core.config import Settings

ATLAS_URI = "mongodb+srv://fixture:fixture@cluster.fixture.mongodb.net/"


def settings(**overrides):
    return Settings(
        _env_file=None,
        **{
            "app_env": "development",
            "mongodb_uri": ATLAS_URI,
            "mongodb_database": "roommate",
            "jwt_secret": "testing-only-secret-with-at-least-32-characters",
            **overrides,
        },
    )


def test_normal_application_uses_atlas():
    configured = settings()
    assert configured.mongodb_database == "roommate"
    assert configured.mongodb_uri.get_secret_value() == ATLAS_URI


@pytest.mark.parametrize("app_env", ["development", "production"])
@pytest.mark.parametrize(
    "uri",
    [
        "mongodb://127.0.0.1:27018",
        "mongodb://localhost:27017",
        "mongodb+srv://user:password@not-atlas.example/",
        "mongodb+srv://user:<db_password>@cluster.fixture.mongodb.net/",
        "mongodb+srv://cluster.fixture.mongodb.net/",
    ],
)
def test_application_rejects_local_or_incomplete_database_connections(app_env, uri):
    with pytest.raises(ValidationError, match="complete MongoDB Atlas"):
        settings(app_env=app_env, cookie_secure=True, mongodb_uri=uri)


def test_database_uri_is_required_without_a_local_default(monkeypatch):
    monkeypatch.delenv("MONGODB_URI", raising=False)
    with pytest.raises(ValidationError, match="mongodb_uri"):
        Settings(_env_file=None, app_env="development", jwt_secret="testing-only-secret-with-at-least-32-characters")


def test_validation_errors_do_not_print_database_credentials():
    sensitive = "DoNotPrintThisPassword123"
    with pytest.raises(ValidationError) as caught:
        settings(mongodb_uri=f"mongodb://fixture:{sensitive}@localhost:27017")
    assert sensitive not in str(caught.value)


def test_disposable_test_database_is_explicit_and_cannot_use_the_live_name():
    config = settings(app_env="test", mongodb_uri="mongodb://127.0.0.1:27017", mongodb_database="qa_roommate")
    assert config.mongodb_database == "qa_roommate"
    with pytest.raises(ValidationError, match="test_ or qa_"):
        settings(app_env="test", mongodb_database="roommate")


def test_production_still_requires_secure_cookies_with_atlas():
    with pytest.raises(ValidationError, match="Production requires COOKIE_SECURE=true"):
        settings(app_env="production", cookie_secure=False)
