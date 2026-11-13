export const money = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);
export const today = (timeZone = "Asia/Kolkata") =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function toPaise(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim()))
    throw new Error("Enter a positive amount with at most two decimal places.");
  const [whole, fraction = ""] = value.trim().split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 10000000000)
    throw new Error("Amount must be between ₹0.01 and ₹10,00,00,000.");
  return amount;
}
export function previewSplit(
  total: number,
  people: string[],
  type: string,
  inputs: Record<string, string>,
) {
  const sorted = [...people].sort();
  if (!sorted.length || !total) return [];
  if (type === "equal")
    return sorted.map((id, i) => ({
      user_id: id,
      share_paise:
        Math.floor(total / sorted.length) + (i < total % sorted.length ? 1 : 0),
    }));
  if (type === "exact") {
    const values = sorted.map((id) => ({
      user_id: id,
      share_paise: /^0+(\.0{1,2})?$/.test(inputs[id] || "0")
        ? 0
        : toPaise(inputs[id]),
    }));
    if (values.reduce((a, x) => a + x.share_paise, 0) !== total)
      throw new Error("Exact shares must add up to the total.");
    return values;
  }
  const basis = sorted.map((id) => ({
    id,
    bp: /^0+(\.0{1,2})?$/.test(inputs[id] || "0") ? 0 : toPaise(inputs[id]),
  }));
  if (basis.reduce((a, x) => a + x.bp, 0) !== 10000)
    throw new Error("Percentages must add up to 100%.");
  const values = basis.map((x) => ({
    user_id: x.id,
    share_paise: Math.floor((total * x.bp) / 10000),
    remainder: (total * x.bp) % 10000,
  }));
  const remainder = total - values.reduce((a, x) => a + x.share_paise, 0);
  [...values]
    .sort(
      (a, b) => b.remainder - a.remainder || a.user_id.localeCompare(b.user_id),
    )
    .slice(0, remainder)
    .forEach((x) => x.share_paise++);
  return values;
}
