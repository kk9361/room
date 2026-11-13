from app.core.errors import require

MAX_MONEY = 100_000_000_00


def split_expense(total: int, participants: list[str], split_type: str, shares=None, percentages=None):
    require(type(total) is int and 0 < total <= MAX_MONEY, "Invalid amount", 422)
    require(
        len(participants) > 0 and len(set(participants)) == len(participants),
        "Choose unique participants",
        422,
    )
    people = sorted(participants)
    if split_type == "equal":
        base, remainder = divmod(total, len(people))
        return [{"user_id": user, "share_paise": base + (i < remainder)} for i, user in enumerate(people)]
    if split_type == "exact":
        values = shares or []
        require(
            len(values) == len(people) and {x["user_id"] for x in values} == set(people),
            "Shares must include each participant exactly once",
            422,
        )
        require(
            all(type(x["share_paise"]) is int and x["share_paise"] >= 0 for x in values),
            "Shares must be nonnegative integer paise",
            422,
        )
        require(sum(x["share_paise"] for x in values) == total, "Shares must add up to total", 422)
        return sorted(values, key=lambda x: x["user_id"])
    require(split_type == "percentage", "Invalid split type", 422)
    values = percentages or []
    require(
        len(values) == len(people) and {x["user_id"] for x in values} == set(people),
        "Percentages must include each participant exactly once",
        422,
    )
    require(
        all(type(x["basis_points"]) is int and x["basis_points"] >= 0 for x in values)
        and sum(x["basis_points"] for x in values) == 10000,
        "Percentages must add up to 100%",
        422,
    )
    allocation = {x["user_id"]: total * x["basis_points"] // 10000 for x in values}
    ranked = sorted(values, key=lambda x: (-(total * x["basis_points"] % 10000), x["user_id"]))
    for item in ranked[: total - sum(allocation.values())]:
        allocation[item["user_id"]] += 1
    return [{"user_id": user, "share_paise": allocation[user]} for user in people]


def balances(members, expenses, settlements):
    result = {
        m["user_id"]: {
            "user_id": m["user_id"],
            "paid_paise": 0,
            "share_paise": 0,
            "settlements_paid_paise": 0,
            "settlements_received_paise": 0,
            "net_paise": 0,
        }
        for m in members
    }

    def entry(user):
        if user not in result:
            result[user] = {
                "user_id": user,
                "paid_paise": 0,
                "share_paise": 0,
                "settlements_paid_paise": 0,
                "settlements_received_paise": 0,
                "net_paise": 0,
            }
        return result[user]

    for expense in expenses:
        if expense["status"] != "posted":
            continue
        entry(expense["paid_by"])["paid_paise"] += expense["total_paise"]
        for share in expense["splits"]:
            entry(share["user_id"])["share_paise"] += share["share_paise"]
    for settlement in settlements:
        if settlement["status"] != "completed":
            continue
        entry(settlement["from_user_id"])["settlements_paid_paise"] += settlement["amount_paise"]
        entry(settlement["to_user_id"])["settlements_received_paise"] += settlement["amount_paise"]
    for item in result.values():
        item["net_paise"] = (
            item["paid_paise"]
            - item["share_paise"]
            + item["settlements_paid_paise"]
            - item["settlements_received_paise"]
        )
    return list(result.values())


def suggestions(items):
    creditors = sorted(
        [[x["user_id"], x["net_paise"]] for x in items if x["net_paise"] > 0], key=lambda x: (-x[1], x[0])
    )
    debtors = sorted(
        [[x["user_id"], -x["net_paise"]] for x in items if x["net_paise"] < 0], key=lambda x: (-x[1], x[0])
    )
    result, i, j = [], 0, 0
    while i < len(debtors) and j < len(creditors):
        amount = min(debtors[i][1], creditors[j][1])
        result.append({"from_user_id": debtors[i][0], "to_user_id": creditors[j][0], "amount_paise": amount})
        debtors[i][1] -= amount
        creditors[j][1] -= amount
        i += debtors[i][1] == 0
        j += creditors[j][1] == 0
    return result
