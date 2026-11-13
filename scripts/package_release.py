"""Package source files only; validate that private configuration is absent."""

import hashlib
import json
import os
import zipfile
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
EXCLUDED = {
    ".git",
    ".venv",
    ".tools",
    "node_modules",
    ".next",
    ".next-qa",
    ".expo",
    "__pycache__",
    ".pytest_cache",
    ".ruff_cache",
    ".local-data",
    ".backups",
    "artifacts",
    "dist",
    "build",
    "android",
    "ios",
    "test-results",
    "playwright-report",
}
TOP_LEVEL = {"apps", "backend", "packages", "scripts", "docs", "infra", "specification"}
ROOT_FILES = {"README.md", ".gitignore", ".env.example", ".dockerignore", "package.json", "package-lock.json"}


def sources():
    for folder in sorted(TOP_LEVEL):
        base = ROOT / folder
        for directory, folders, filenames in os.walk(base):
            folders[:] = sorted(folder for folder in folders if folder not in EXCLUDED)
            for filename in sorted(filenames):
                path = Path(directory) / filename
                if path.name.startswith(".env") and path.name != ".env.example":
                    continue
                if path.suffix in {".pyc", ".log", ".tsbuildinfo", ".keystore", ".jks"}:
                    continue
                yield path
    for name in sorted(ROOT_FILES):
        if (ROOT / name).exists():
            yield ROOT / name


def main():
    target = ROOT / "artifacts/RoomMate-Ledger-source.zip"
    target.parent.mkdir(exist_ok=True)
    files = list(sources())
    # Check actual private values, including the Mongo URI and administrator secret,
    # against every packaged text/binary source. Do not print those values.
    from dotenv import dotenv_values

    private = dotenv_values(ROOT / ".env")
    secrets = [
        str(private[k]).encode()
        for k in ("MONGODB_URI", "JWT_SECRET", "BOOTSTRAP_PASSWORD")
        if private.get(k) and len(str(private[k])) >= 12
    ]
    password = urlsplit(private.get("MONGODB_URI") or "").password
    if password:
        secrets.extend([password.encode(), unquote(password).encode()])
    build_files = []
    for directory in (ROOT / "apps/web/.next/static", ROOT / "apps/mobile/dist"):
        if directory.exists():
            build_files.extend(p for p in directory.rglob("*") if p.is_file())
    for path in [*files, *build_files]:
        content = path.read_bytes()
        if any(value in content for value in secrets):
            raise RuntimeError(f"Private value found in source file: {path.relative_to(ROOT)}")
    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in files:
            archive.write(path, "roommate-ledger/" + path.relative_to(ROOT).as_posix())
    with zipfile.ZipFile(target) as archive:
        if archive.testzip() is not None:
            raise RuntimeError("Archive integrity check failed")
        assert not any(Path(name).name == ".env" for name in archive.namelist())
    checksum = hashlib.sha256(target.read_bytes()).hexdigest()
    target.with_suffix(".sha256").write_text(checksum + "  " + target.name + "\n")
    print(
        json.dumps(
            {
                "archive": str(target),
                "files": len(files),
                "bytes": target.stat().st_size,
                "sha256": checksum,
                "secret_scan": "PASS",
                "integrity": "PASS",
            }
        )
    )


if __name__ == "__main__":
    main()
