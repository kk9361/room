import json
import os
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / "backend"))
os.environ.setdefault("JWT_SECRET", "openapi-generation-only-not-a-runtime-secret")
from app.main import app

target = root / "packages/api-contract/openapi.json"
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(app.openapi(), indent=2) + "\n", encoding="utf-8")
print(f"Exported {len(app.openapi()['paths'])} API paths to packages/api-contract/openapi.json")
