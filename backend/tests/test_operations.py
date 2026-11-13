import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from database_tools import backup, reconcile, restore


def test_backup_restore_and_reconcile(client, household, tmp_path):
    async def operation():
        db = client.app.state.db
        result = await reconcile(db)
        assert result["valid"]
        file = tmp_path / "backup.json"
        result = await backup(db, file)
        assert result["counts"]["users"] == 4
        target = "roommate_restore_test_operations"
        restored = await restore(db.client, file, target, db.name)
        assert restored["valid"]
        assert await db.client[target].users.count_documents({}) == 4
        with pytest.raises(ValueError):
            await restore(db.client, file, target, db.name)
        with pytest.raises(ValueError):
            await restore(db.client, file, db.name, db.name)
        await db.client.drop_database(target)

    client.portal.call(operation)
