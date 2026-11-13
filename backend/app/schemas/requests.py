from datetime import date
from typing import Annotated, Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Identifier = Annotated[str, StringConstraints(min_length=1, max_length=64)]
Money = Annotated[int, Field(strict=True, gt=0, le=10_000_000_000)]
Password = Annotated[str, StringConstraints(min_length=12, max_length=128)]


class RequestModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Login(RequestModel):
    identifier: Text
    password: Annotated[str, StringConstraints(min_length=1, max_length=128)]
    device_label: str = Field(default="Web", max_length=100)
    client: Literal["web", "mobile"] = "web"


class Register(RequestModel):
    username: Annotated[str, StringConstraints(pattern=r"^[a-zA-Z0-9_]{3,40}$")]
    email: str | None = Field(default=None, max_length=254)
    display_name: Text
    password: Password

    @field_validator("email")
    @classmethod
    def email_valid(cls, value):
        if value is None or value == "":
            return None
        if "@" not in value or "." not in value.rsplit("@", 1)[-1]:
            raise ValueError("Enter a valid email address")
        return value.strip().lower()


class Refresh(RequestModel):
    refresh_token: str | None = Field(default=None, max_length=200)
    client: Literal["web", "mobile"] = "web"


class PasswordChange(RequestModel):
    current_password: Annotated[str, StringConstraints(max_length=128)]
    new_password: Password
    client: Literal["web", "mobile"] = "web"


class Profile(RequestModel):
    display_name: Text


class RoomCreate(RequestModel):
    name: Text
    timezone: str = "Asia/Kolkata"

    @field_validator("timezone")
    @classmethod
    def timezone_valid(cls, value):
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError:
            raise ValueError("Unknown timezone")
        return value


class RoomPatch(RequestModel):
    name: Text | None = None
    status: Literal["active", "archived"] | None = None
    allow_member_expenses: bool | None = None
    timezone: str | None = None

    @field_validator("timezone")
    @classmethod
    def timezone_valid(cls, value):
        return RoomCreate.timezone_valid(value) if value else value


class Invitation(RequestModel):
    email_or_username: Text
    expires_in_days: int = Field(default=7, ge=1, le=30)
    role: Literal["room_admin", "room_member"] = "room_member"


class AcceptInvitation(RequestModel):
    token: Annotated[str, StringConstraints(min_length=20, max_length=200)]


class MemberPatch(RequestModel):
    role: Literal["room_admin", "room_member"] | None = None
    status: Literal["active", "removed", "left"] | None = None


class Category(RequestModel):
    name: Text
    icon: str = Field(default="tag", max_length=40)


class CategoryPatch(RequestModel):
    name: Text | None = None
    is_active: bool | None = None


class Share(RequestModel):
    user_id: Identifier
    share_paise: int = Field(strict=True, ge=0, le=10_000_000_000)


class Percentage(RequestModel):
    user_id: Identifier
    basis_points: int = Field(strict=True, ge=0, le=10000)


class Expense(RequestModel):
    expense_date: date
    description: Text
    category_id: Identifier | None = None
    paid_by: Identifier
    total_paise: Money
    split_type: Literal["equal", "exact", "percentage"] = "equal"
    participants: list[Identifier] = Field(min_length=1, max_length=100)
    shares: list[Share] | None = Field(default=None, max_length=100)
    percentages: list[Percentage] | None = Field(default=None, max_length=100)


class Reverse(RequestModel):
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=500)]


class PersonalExpense(RequestModel):
    expense_date: date
    description: Text
    category_id: Identifier | None = None
    amount_paise: Money
    notes: str = Field(default="", max_length=2000)


class PersonalPatch(RequestModel):
    expense_date: date | None = None
    description: Text | None = None
    category_id: Identifier | None = None
    amount_paise: Money | None = None
    notes: str | None = Field(default=None, max_length=2000)


class Settlement(RequestModel):
    from_user_id: Identifier
    to_user_id: Identifier
    amount_paise: Money
    payment_method: Literal["upi", "cash", "bank", "other"] = "upi"
    note: str = Field(default="", max_length=500)


class Announcement(RequestModel):
    title: Text
    body: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)]


class AnnouncementPatch(RequestModel):
    title: Text | None = None
    body: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)] | None = (
        None
    )
    status: Literal["published", "archived"] | None = None


class AnnouncementRead(RequestModel):
    announcement_ids: list[Identifier] = Field(min_length=1, max_length=100)


class AccountStatus(RequestModel):
    status: Literal["active", "disabled"]


class ClearApplicationData(RequestModel):
    confirmation: Literal["CLEAR ALL DATA"]
    current_password: Annotated[str, StringConstraints(min_length=12, max_length=128)]
