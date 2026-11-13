from datetime import date

from fastapi import APIRouter, Depends, Query, Request, Response
from pymongo import ReturnDocument

from app.core.errors import require
from app.core.security import now
from app.repositories.store import public
from app.schemas.requests import Expense, PersonalExpense, PersonalPatch, Reverse, Settlement
from app.services.auth import current_user
from app.services.context import audit, category_access, date_query, financial_create, room_access, store
from app.services.finance import balances, split_expense, suggestions

router = APIRouter(tags=["Ledger"])


async def active_members(request, room, ids):
    members = {m["user_id"] for m in room["members"] if m["status"] == "active"}
    require(set(ids) <= members, "Payer and participants must be active room members", 422)
    count = await store(request).db.users.count_documents(
        {"_id": {"$in": list(set(ids))}, "status": "active"}
    )
    require(count == len(set(ids)), "One or more selected accounts are disabled", 422)


@router.post("/rooms/{room_id}/expenses", status_code=201)
async def create_expense(
    room_id: str, body: Expense, request: Request, response: Response, user=Depends(current_user)
):
    room, member = await room_access(request, room_id, user, write=True)
    require(
        room["settings"]["allow_member_expenses"] or member["role"] == "room_admin",
        "This room permits only administrators to post expenses",
        403,
    )
    await active_members(request, room, [body.paid_by, *body.participants])
    await category_access(request, body.category_id, room_id)
    data = body.model_dump(mode="json")
    splits = split_expense(
        body.total_paise, body.participants, body.split_type, data["shares"], data["percentages"]
    )
    result, created = await financial_create(
        request, "expenses", room_id, user, data, {"splits": splits, "status": "posted"}
    )
    if created:
        await audit(request, user, "expense.post", "expense", result["_id"], room_id)
    else:
        response.status_code = 200
    return public(result)


@router.get("/rooms/{room_id}/expenses")
async def expenses(
    room_id: str,
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    category_id: str | None = None,
    search: str | None = Query(None, max_length=100),
    user=Depends(current_user),
):
    import re

    await room_access(request, room_id, user)
    query = {"room_id": room_id, **date_query(from_date, to_date)}
    if category_id:
        query["category_id"] = category_id
    if search:
        query["description"] = {"$regex": re.escape(search), "$options": "i"}
    return await store(request).page("expenses", query, page, page_size, "expense_date")


@router.get("/rooms/{room_id}/expenses/{expense_id}")
async def expense_detail(room_id: str, expense_id: str, request: Request, user=Depends(current_user)):
    await room_access(request, room_id, user)
    return public(await store(request).get("expenses", {"_id": expense_id, "room_id": room_id}))


@router.post("/rooms/{room_id}/expenses/{expense_id}/reverse")
async def reverse_expense(
    room_id: str, expense_id: str, body: Reverse, request: Request, user=Depends(current_user)
):
    _, member = await room_access(request, room_id, user, write=True)
    expense = await store(request).get("expenses", {"_id": expense_id, "room_id": room_id})
    require(
        expense["created_by"] == user["_id"] or member["role"] == "room_admin",
        "Only the creator or room administrator can reverse this expense",
        403,
    )
    if expense["status"] == "reversed":
        require(
            expense["reversal_reason"] == body.reason, "Expense already reversed for a different reason", 409
        )
        return public(expense)
    result = await store(request).db.expenses.find_one_and_update(
        {"_id": expense_id, "room_id": room_id, "status": "posted"},
        {
            "$set": {
                "status": "reversed",
                "reversed_at": now(),
                "reversal_reason": body.reason,
                "reversed_by": user["_id"],
                "updated_at": now(),
            }
        },
        return_document=ReturnDocument.AFTER,
    )
    require(result, "Expense changed. Refresh and retry.", 409)
    await audit(request, user, "expense.reverse", "expense", expense_id, room_id, {"reason": body.reason})
    return public(result)


async def room_balances(request, room_id, user):
    room, _ = await room_access(request, room_id, user)
    expenses = (
        await store(request).db.expenses.find({"room_id": room_id, "status": "posted"}).to_list(length=None)
    )
    settlements = (
        await store(request)
        .db.settlements.find({"room_id": room_id, "status": "completed"})
        .to_list(length=None)
    )
    result = balances(room["members"], expenses, settlements)
    return {
        "items": result,
        "total_shared_paise": sum(x["total_paise"] for x in expenses),
        "reconciled": sum(x["net_paise"] for x in result) == 0,
    }


@router.get("/rooms/{room_id}/balances")
async def get_balances(room_id: str, request: Request, user=Depends(current_user)):
    return await room_balances(request, room_id, user)


@router.get("/rooms/{room_id}/balances/me")
async def my_balance(room_id: str, request: Request, user=Depends(current_user)):
    result = await room_balances(request, room_id, user)
    return next(x for x in result["items"] if x["user_id"] == user["_id"])


@router.get("/rooms/{room_id}/settlements/suggestions")
async def get_suggestions(room_id: str, request: Request, user=Depends(current_user)):
    result = await room_balances(request, room_id, user)
    return {"items": suggestions(result["items"])}


@router.post("/rooms/{room_id}/settlements", status_code=201)
async def create_settlement(
    room_id: str, body: Settlement, request: Request, response: Response, user=Depends(current_user)
):
    room, _ = await room_access(request, room_id, user, write=True)
    require(body.from_user_id != body.to_user_id, "Choose two different members", 422)
    require(user["_id"] in {body.from_user_id, body.to_user_id}, "You must be part of this settlement", 403)
    await active_members(request, room, [body.from_user_id, body.to_user_id])
    result, created = await financial_create(
        request, "settlements", room_id, user, body.model_dump(), {"status": "pending"}
    )
    if created:
        await audit(request, user, "settlement.create", "settlement", result["_id"], room_id)
    else:
        response.status_code = 200
    return public(result)


@router.get("/rooms/{room_id}/settlements")
async def get_settlements(
    room_id: str,
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user=Depends(current_user),
):
    await room_access(request, room_id, user)
    return await store(request).page("settlements", {"room_id": room_id}, page, page_size)


async def transition_settlement(request, room_id, settlement_id, user, action):
    await room_access(request, room_id, user, write=True)
    settlement = await store(request).get("settlements", {"_id": settlement_id, "room_id": room_id})
    if action in ("confirm", "reject"):
        require(
            user["_id"] == settlement["to_user_id"], "Only the recipient can confirm or reject receipt", 403
        )
    else:
        require(user["_id"] == settlement["from_user_id"], "Only the sender can cancel", 403)
    target = {"confirm": "completed", "reject": "rejected", "cancel": "cancelled"}[action]
    if settlement["status"] == target:
        return public(settlement)
    require(settlement["status"] == "pending", "Settlement is already finalized", 409)
    changes = {"status": target, "updated_at": now(), "finalized_by": user["_id"], "finalized_at": now()}
    if target == "completed":
        changes["completed_at"] = now()
    result = await store(request).db.settlements.find_one_and_update(
        {"_id": settlement_id, "status": "pending"}, {"$set": changes}, return_document=ReturnDocument.AFTER
    )
    require(result, "Settlement changed. Refresh and retry.", 409)
    await audit(request, user, f"settlement.{action}", "settlement", settlement_id, room_id)
    return public(result)


@router.post("/rooms/{room_id}/settlements/{settlement_id}/confirm")
async def confirm_settlement(room_id: str, settlement_id: str, request: Request, user=Depends(current_user)):
    return await transition_settlement(request, room_id, settlement_id, user, "confirm")


@router.post("/rooms/{room_id}/settlements/{settlement_id}/reject")
async def reject_settlement(room_id: str, settlement_id: str, request: Request, user=Depends(current_user)):
    return await transition_settlement(request, room_id, settlement_id, user, "reject")


@router.post("/rooms/{room_id}/settlements/{settlement_id}/cancel")
async def cancel_settlement(room_id: str, settlement_id: str, request: Request, user=Depends(current_user)):
    return await transition_settlement(request, room_id, settlement_id, user, "cancel")


@router.post("/personal/expenses", status_code=201)
async def create_personal(body: PersonalExpense, request: Request, user=Depends(current_user)):
    await category_access(request, body.category_id, f"personal:{user['_id']}")
    result = await store(request).insert(
        "personal_expenses",
        {**body.model_dump(mode="json"), "owner_user_id": user["_id"], "status": "active"},
    )
    await audit(request, user, "personal.create", "personal_expense", result["_id"])
    return public(result)


@router.get("/personal/expenses")
async def personal_expenses(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    category_id: str | None = None,
    search: str | None = Query(None, max_length=100),
    user=Depends(current_user),
):
    import re

    query = {"owner_user_id": user["_id"], "status": "active", **date_query(from_date, to_date)}
    if category_id:
        query["category_id"] = category_id
    if search:
        query["description"] = {"$regex": re.escape(search), "$options": "i"}
    return await store(request).page("personal_expenses", query, page, page_size, "expense_date")


@router.get("/personal/expenses/{expense_id}")
async def personal_detail(expense_id: str, request: Request, user=Depends(current_user)):
    return public(
        await store(request).get(
            "personal_expenses", {"_id": expense_id, "owner_user_id": user["_id"], "status": "active"}
        )
    )


@router.patch("/personal/expenses/{expense_id}")
async def update_personal(expense_id: str, body: PersonalPatch, request: Request, user=Depends(current_user)):
    await category_access(request, body.category_id, f"personal:{user['_id']}")
    changes = body.model_dump(mode="json", exclude_unset=True)
    require(
        all(v is not None for k, v in changes.items() if k != "category_id"), "Values cannot be null", 422
    )
    result = await store(request).update(
        "personal_expenses", {"_id": expense_id, "owner_user_id": user["_id"], "status": "active"}, changes
    )
    await audit(request, user, "personal.update", "personal_expense", expense_id)
    return public(result)


@router.delete("/personal/expenses/{expense_id}")
async def delete_personal(expense_id: str, request: Request, user=Depends(current_user)):
    await store(request).update(
        "personal_expenses",
        {"_id": expense_id, "owner_user_id": user["_id"], "status": "active"},
        {"status": "deleted"},
    )
    await audit(request, user, "personal.delete", "personal_expense", expense_id)
    return {"message": "Personal expense deleted"}
