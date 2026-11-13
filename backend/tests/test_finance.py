import random

import pytest
from app.core.errors import DomainError
from app.services.finance import balances, split_expense, suggestions


def test_equal_deterministic_remainder():
    assert split_expense(100, ["c", "b", "a"], "equal") == [
        {"user_id": "a", "share_paise": 34},
        {"user_id": "b", "share_paise": 33},
        {"user_id": "c", "share_paise": 33},
    ]


def test_exact_rejects_wrong_totals_and_duplicates():
    for shares in (
        [{"user_id": "a", "share_paise": 100}],
        [{"user_id": "a", "share_paise": 10}, {"user_id": "b", "share_paise": 10}],
        [{"user_id": "a", "share_paise": 50}, {"user_id": "a", "share_paise": 50}],
    ):
        with pytest.raises(DomainError):
            split_expense(100, ["a", "b"], "exact", shares)


def test_percentage_largest_remainder():
    result = split_expense(
        101,
        ["a", "b", "c"],
        "percentage",
        percentages=[
            {"user_id": "a", "basis_points": 3333},
            {"user_id": "b", "basis_points": 3333},
            {"user_id": "c", "basis_points": 3334},
        ],
    )
    assert [x["share_paise"] for x in result] == [34, 33, 34]
    with pytest.raises(DomainError):
        split_expense(100, ["a"], "percentage", percentages=[{"user_id": "a", "basis_points": 9999}])


def test_many_splits_conserve_every_paisa():
    rng = random.Random(17)
    for _ in range(500):
        total = rng.randrange(1, 10_000_000_000)
        people = [str(i) for i in range(rng.randrange(1, 11))]
        cuts = sorted([0, 10000, *[rng.randrange(10001) for _ in range(len(people) - 1)]])
        pcts = [{"user_id": person, "basis_points": cuts[i + 1] - cuts[i]} for i, person in enumerate(people)]
        for kind in ("equal", "percentage"):
            shares = split_expense(total, people, kind, percentages=pcts)
            assert sum(x["share_paise"] for x in shares) == total
            assert all(type(x["share_paise"]) is int and x["share_paise"] >= 0 for x in shares)


def test_balances_and_suggestions():
    members = [{"user_id": x} for x in "abc"]
    expense = {
        "paid_by": "a",
        "total_paise": 90000,
        "status": "posted",
        "splits": split_expense(90000, list("abc"), "equal"),
    }
    initial = balances(members, [expense], [])
    assert [x["net_paise"] for x in initial] == [60000, -30000, -30000]
    transfers = suggestions(initial)
    assert len(transfers) == 2
    assert all(
        x["net_paise"] == 0
        for x in balances(members, [expense], [{**x, "status": "completed"} for x in transfers])
    )
    assert balances(members, [{**expense, "status": "reversed"}], [])[0]["net_paise"] == 0


@pytest.mark.parametrize("amount", [0, -1, 1.5, True, 10_000_000_001])
def test_invalid_money(amount):
    with pytest.raises(DomainError):
        split_expense(amount, ["a"], "equal")
