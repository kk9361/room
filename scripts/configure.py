"""Create private backend secrets without echoing any credential."""

import getpass
import secrets
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]


def main():
    path = ROOT / ".env"
    if path.exists():
        print("Existing .env preserved. Edit it locally to update configuration.")
        return
    cluster = input("Atlas hostname (blank for local-only mode): ").strip()
    if cluster:
        if any(c in cluster for c in "/\\\n\r@?"):
            raise ValueError("Enter only the Atlas hostname, e.g. cluster0.example.mongodb.net")
        username = input("Atlas database username: ").strip()
        password = getpass.getpass("Atlas database password (hidden): ")
        uri = f"mongodb+srv://{quote(username, safe='')}:{quote(password, safe='')}@{cluster}/?retryWrites=true&w=majority"
    else:
        uri = "mongodb://127.0.0.1:27018"
    database = input("Database name [roommate]: ").strip() or "roommate"
    if not database.replace("_", "").isalnum():
        raise ValueError("Use letters, numbers, and underscores in database name")
    admin_password = getpass.getpass("Choose temporary admin password (12+ characters, hidden): ")
    if len(admin_password) < 12 or any(c in admin_password for c in "\n\r"):
        raise ValueError("Choose a password with at least 12 characters and no newlines")
    content = (
        f"APP_ENV=development\nMONGODB_URI={uri}\nMONGODB_DATABASE={database}\n"
        f"JWT_SECRET={secrets.token_urlsafe(48)}\nBOOTSTRAP_USERNAME=admin\n"
        f'BOOTSTRAP_PASSWORD="{admin_password.replace(chr(92), chr(92) * 2).replace(chr(34), chr(92) + chr(34))}"\n'
        "COOKIE_SECURE=false\nCORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000\n"
    )
    path.write_text(content, encoding="utf-8")
    print("Private .env created. No secrets were printed. Sign in as admin; change the temporary password.")


if __name__ == "__main__":
    main()
