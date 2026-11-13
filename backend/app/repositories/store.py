from copy import deepcopy

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.core.errors import DomainError, require
from app.core.security import now, uid


def public(document):
    if document is None:
        return None
    result = deepcopy(document)
    result["id"] = result.pop("_id")
    for key in (
        "password_hash",
        "token_hash",
        "used_hashes",
        "request_hash",
        "invitations",
        "unread_user_ids",
        "auth_version",
    ):
        result.pop(key, None)
    return result


class Store:
    def __init__(self, db):
        self.db = db

    async def get(self, collection, query):
        result = await self.db[collection].find_one(query)
        require(result)
        return result

    async def insert(self, collection, data):
        document = {"_id": uid(), "created_at": now(), "updated_at": now(), **data}
        try:
            await self.db[collection].insert_one(document)
        except DuplicateKeyError:
            raise DomainError(409, "A record with these details already exists", "CONFLICT")
        return document

    async def update(self, collection, query, changes):
        result = await self.db[collection].find_one_and_update(
            query, {"$set": {**changes, "updated_at": now()}}, return_document=ReturnDocument.AFTER
        )
        require(result)
        return result

    async def page(self, collection, query, page=1, page_size=20, sort="created_at"):
        total = await self.db[collection].count_documents(query)
        items = (
            await self.db[collection]
            .find(query)
            .sort([(sort, -1), ("_id", -1)])
            .skip((page - 1) * page_size)
            .limit(page_size)
            .to_list(length=page_size)
        )
        return {"items": [public(x) for x in items], "page": page, "page_size": page_size, "total": total}
