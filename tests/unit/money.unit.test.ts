import { describe, expect, it } from "vitest";
import { parseMoneyToCents } from "../../src/engine/money";

describe("parseMoneyToCents", () => {
  it.each([
    ["$1,234.56", 123456],
    ["(500.00)", -50000],
    ["1234.5", 123450],
    ["19.99", 1999],
    ["0.00", 0],
    ["  42 ", 4200],
    ["-$5.00", -500],
    ["(0.00)", 0],
  ])("parses %j to %d", (input, cents) => {
    expect(parseMoneyToCents(input)).toEqual({ ok: true, value: cents });
  });

  it.each([
    "1,234.567",
    "",
    "abc",
    "1e3",
    "1,23.45",
    "$",
    "(5.00",
    "--5",
    "$-5.00",
    "(-5.00)",
    "99999999999999999",
  ])("rejects %j", (input) => {
    expect(parseMoneyToCents(input).ok).toBe(false);
  });
});
