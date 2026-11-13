from datetime import datetime
from typing import TypedDict


class SplitDocument(TypedDict):
    user_id: str
    share_paise: int


class ExpenseDocument(TypedDict):
    _id: str
    room_id: str
    created_by: str
    paid_by: str
    total_paise: int
    splits: list[SplitDocument]
    status: str
    created_at: datetime
