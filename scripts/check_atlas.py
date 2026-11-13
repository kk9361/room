"""Read-only connectivity diagnostic. Never prints a URI or password."""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from app.core.config import Settings
from app.database.connection import client_for
from pymongo.errors import OperationFailure, PyMongoError


async def main():
    settings = Settings()
    client = client_for(settings)
    try:
        await client.admin.command("ping")
        hello = await client.admin.command("hello")
        print(
            {
                "connection": "PASS",
                "database": settings.mongodb_database,
                "replica_set": bool(hello.get("setName")),
                "sessions": "logicalSessionTimeoutMinutes" in hello,
                "financial_storage": "atomic single-document expenses with embedded splits",
            }
        )
    except OperationFailure as error:
        print(
            {
                "connection": "FAIL",
                "code": error.code,
                "reason": "Authentication rejected"
                if error.code in (18, 8000)
                else "Database authorization rejected",
            }
        )
        return 1
    except PyMongoError as error:
        print(
            {
                "connection": "FAIL",
                "reason": type(error).__name__,
                "action": "Check Atlas hostname, network access list, DNS, and TLS",
            }
        )
        return 1
    finally:
        await client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
