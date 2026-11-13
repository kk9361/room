import { test, expect } from "@playwright/test";
import { toPaise, previewSplit } from "../../../packages/api-contract/money";
test("client money parser and split previews preserve integer paise", () => {
  expect(toPaise("1250.99")).toBe(125099);
  for (const bad of ["1.001", "-1", "0", "NaN", "1e3"])
    expect(() => toPaise(bad)).toThrow();
  for (let total = 1; total < 10000; total += 79) {
    for (const split of ["equal", "percentage"]) {
      const result = previewSplit(total, ["c", "a", "b"], split, {
        a: "33.33",
        b: "33.33",
        c: "33.34",
      });
      expect(result.reduce((sum, x) => sum + x.share_paise, 0)).toBe(total);
      expect(result.every((x) => Number.isInteger(x.share_paise))).toBeTruthy();
    }
  }
  expect(
    previewSplit(100, ["a", "b"], "exact", { a: "1.00", b: "0.00" }),
  ).toEqual([
    { user_id: "a", share_paise: 100 },
    { user_id: "b", share_paise: 0 },
  ]);
  expect(
    previewSplit(100, ["a", "b"], "percentage", { a: "100", b: "0.00" }),
  ).toEqual([
    { user_id: "a", share_paise: 100, remainder: 0 },
    { user_id: "b", share_paise: 0, remainder: 0 },
  ]);
});
