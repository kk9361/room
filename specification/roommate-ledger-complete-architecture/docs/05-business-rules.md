# 05 — Business Rules and Financial Logic

## 1. Money
- API accepts integer `amount_paise`.
- UI displays rupees by dividing paise by 100 and formatting with `en-IN`.
- Never use binary floating-point for money.
- Validate amount > 0 and apply configured sensible maximums.
- Convert decimal user input to paise using decimal arithmetic on the client and server validation.

## 2. Splitting
### Equal
For total `T` paise and `N` participants:
- `base = T // N`
- `remainder = T % N`
- Sort participant IDs lexicographically for deterministic allocation.
- First `remainder` IDs receive `base + 1`; remaining receive `base`.
- Sum of shares must equal T.

### Exact
- Each participant share is integer paise.
- No negative shares.
- Sum exactly equals total.

### Percentage
- Accept integer basis points (10000 = 100%).
- Validate sum is exactly 10000.
- Calculate raw shares using integer multiplication and division.
- Allocate remaining paise using largest-remainder method with deterministic user-ID tie break.
- Final shares sum exactly to total.

## 3. Balance formula
For each member in a room, calculate:
`net_paise = shared_amount_paid - assigned_shared_shares + completed_settlements_paid - completed_settlements_received`

Interpretation:
- Positive net: member is owed money.
- Negative net: member owes money.
- Zero: settled.

Only posted, non-reversed shared expenses count. Only completed settlements count. Personal expenses never affect room balances.

## 4. Settlement suggestions
- Separate creditors (positive net) and debtors (negative net).
- Repeatedly match one debtor with one creditor for `min(debt, credit)`.
- Emit suggested transfers until all balances are zero.
- This greedy approach is adequate for a small room and minimizes unnecessary complexity, though it is not guaranteed globally optimal for every objective.
- Suggestions are proposals, not financial transactions; only completed settlement records change balances.
- Validate from/to users are active members and amount is positive.

## 5. Expense lifecycle
- Draft exists only on client until submitted (unless server-side drafts are explicitly added later).
- Posted expenses are immutable.
- Correction uses reversal with reason and a replacement expense.
- Require creator or room admin to reverse; optionally allow a configurable time window.
- Keep audit record for create/reverse.

## 6. Privacy
- Room shared expense records visible to active room members.
- Personal expense records visible only to owner.
- Room admins cannot query personal expenses for members.
- Never include personal expense values in room-level aggregate endpoints.
- Personal report endpoints must be scoped to authenticated user; ignore any client-supplied owner ID.

## 7. Reporting
- Room report totals shared expenses by month/category/payer.
- Member report shows paid amount, assigned share, net, completed settlements.
- Personal report aggregates only current user's personal expenses.
- Date ranges use room timezone boundaries, then convert to UTC for queries.
