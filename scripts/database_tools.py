"""Reconcile, back up, and restore into a new, explicitly named database."""

import argparse
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from app.core.config import Settings
from app.database.connection import client_for, indexes
from bson import json_util

COLLECTIONS = (
    "users",
    "rooms",
    "categories",
    "expenses",
    "settlements",
    "personal_expenses",
    "announcements",
    "audit_logs",
)


async def reconcile(db):
    invalid = []
    count = 0
    async for expense in db.expenses.find({}):
        count += 1
        splits = expense.get("splits", [])
        if (
            type(expense.get("total_paise")) is not int
            or sum(s["share_paise"] for s in splits) != expense["total_paise"]
            or len({s["user_id"] for s in splits}) != len(splits)
            or any(type(s["share_paise"]) is not int or s["share_paise"] < 0 for s in splits)
        ):
            invalid.append(expense["_id"])
    return {"expenses_checked": count, "invalid_expense_ids": invalid, "valid": not invalid}


async def backup(db, path):
    if path.exists():
        raise ValueError("Backup file already exists; choose a new filename")
    path.parent.mkdir(parents=True, exist_ok=True)
    data = {"schema_version": 1, "collections": {}}
    for name in COLLECTIONS:
        data["collections"][name] = await db[name].find({}).to_list(length=None)
    path.write_text(json_util.dumps(data), encoding="utf-8")
    return {"backup": str(path), "counts": {k: len(v) for k, v in data["collections"].items()}}


async def restore(client, source, target, configured_database):
    if not target.startswith("roommate_restore_") or target == configured_database:
        raise ValueError("Restore target must start with roommate_restore_ and differ from the live database")
    if target in await client.list_database_names():
        raise ValueError("Restore target already exists. Existing databases are never overwritten.")
    data = json_util.loads(source.read_text(encoding="utf-8"))
    if data.get("schema_version") != 1 or set(data.get("collections", {})) != set(COLLECTIONS):
        raise ValueError("Unsupported backup format")
    db = client[target]
    await indexes(db)
    for name in COLLECTIONS:
        if data["collections"][name]:
            await db[name].insert_many(data["collections"][name])
    return {"restored_database": target, **await reconcile(db)}


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["reconcile", "backup", "restore"])
    parser.add_argument("--file", type=Path)
    parser.add_argument("--database")
    args = parser.parse_args()
    settings = Settings()
    client = client_for(settings)
    try:
        db = client[settings.mongodb_database]
        if args.action == "reconcile":
            result = await reconcile(db)
        elif args.action == "backup":
            if not args.file:
                parser.error("--file is required")
            result = await backup(db, args.file)
        else:
            if not args.file or not args.database:
                parser.error("--file and --database are required")
            result = await restore(client, args.file, args.database, settings.mongodb_database)
        print(json.dumps(result))
        return 0 if result.get("valid", True) else 1
    except Exception as error:
        print(json.dumps({"status": "failed", "error_type": type(error).__name__}))
        return 1
    finally:
        await client.close()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
