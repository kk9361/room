import calendar
import csv
import io
from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query, Request, Response

from app.core.errors import require
from app.services.auth import current_user
from app.services.context import date_query, room_access, store
from app.services.finance import balances

router = APIRouter(tags=["Reports"])


def bounds(year, month=None):
    return (date(year, month or 1, 1), date(year, month or 12, calendar.monthrange(year, month or 12)[1]))


def summarize(expenses, amount_key="total_paise"):
    categories, payers, months = {}, {}, {}
    for item in expenses:
        amount = item[amount_key]
        category = item.get("category_id") or "uncategorized"
        categories[category] = categories.get(category, 0) + amount
        month = item["expense_date"][:7]
        months[month] = months.get(month, 0) + amount
        if "paid_by" in item:
            payers[item["paid_by"]] = payers.get(item["paid_by"], 0) + amount
    return {
        "total_paise": sum(x[amount_key] for x in expenses),
        "count": len(expenses),
        "by_category": [{"category_id": k, "amount_paise": v} for k, v in categories.items()],
        "by_payer": [{"user_id": k, "amount_paise": v} for k, v in payers.items()],
        "by_month": [{"month": k, "amount_paise": v} for k, v in sorted(months.items())],
    }


async def room_report(request, room_id, user, year, month=None):
    room, _ = await room_access(request, room_id, user)
    start, end = bounds(year, month)
    expenses = (
        await store(request)
        .db.expenses.find({"room_id": room_id, "status": "posted", **date_query(start, end)})
        .to_list(length=None)
    )
    tz = ZoneInfo(room["timezone"])
    # Ledger dates are local calendar dates. Settlement timestamps use the room's UTC boundaries.
    start_utc = datetime(start.year, start.month, start.day, tzinfo=tz).astimezone(UTC)
    from datetime import timedelta

    following = end + timedelta(days=1)
    end_utc = datetime(following.year, following.month, following.day, tzinfo=tz).astimezone(UTC)
    settlements = (
        await store(request)
        .db.settlements.find(
            {"room_id": room_id, "status": "completed", "completed_at": {"$gte": start_utc, "$lt": end_utc}}
        )
        .to_list(length=None)
    )
    return {
        **summarize(expenses),
        "year": year,
        "month": month,
        "currency": "INR",
        "member_totals": balances(room["members"], expenses, settlements),
    }


@router.get("/rooms/{room_id}/reports/monthly")
async def monthly(
    room_id: str,
    request: Request,
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    user=Depends(current_user),
):
    return await room_report(request, room_id, user, year, month)


@router.get("/rooms/{room_id}/reports/annual")
async def annual(
    room_id: str, request: Request, year: int = Query(..., ge=2000, le=2100), user=Depends(current_user)
):
    return await room_report(request, room_id, user, year)


@router.get("/personal/reports/monthly")
async def personal_monthly(
    request: Request,
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    user=Depends(current_user),
):
    start, end = bounds(year, month)
    expenses = (
        await store(request)
        .db.personal_expenses.find(
            {"owner_user_id": user["_id"], "status": "active", **date_query(start, end)}
        )
        .to_list(length=None)
    )
    return {**summarize(expenses, "amount_paise"), "year": year, "month": month, "currency": "INR"}


def safe_cell(value):
    text = str(value)
    # Prevent spreadsheet formulas in descriptions and member-controlled strings.
    return "'" + text if text.lstrip().startswith(("=", "+", "-", "@", "\t", "\r", "\n")) else text


@router.get("/rooms/{room_id}/reports/export")
async def export(
    room_id: str,
    request: Request,
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    format: str = "csv",
    user=Depends(current_user),
):
    await room_access(request, room_id, user)
    require(format == "csv", "Only CSV export is supported", 422)
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(["Date", "Description", "Payer ID", "Total paise", "Status"])
    async for item in (
        store(request)
        .db.expenses.find({"room_id": room_id, "status": "posted", **date_query(from_date, to_date)})
        .sort("expense_date", 1)
    ):
        writer.writerow(
            [safe_cell(item[k]) for k in ("expense_date", "description", "paid_by", "total_paise", "status")]
        )
    return Response(
        "\ufeff" + output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="room-expenses.csv"',
            "Cache-Control": "no-store",
        },
    )
