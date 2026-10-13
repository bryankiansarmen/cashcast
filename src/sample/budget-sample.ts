import type { Budget, CategoryRule, Transaction } from "../budget/types";
import { SAMPLE_BUDGET_SEED, SAMPLE_MONTHS } from "./constants";
import { mulberry32, randInt } from "./prng";

// All businesses and people here are fictional.
export const SAMPLE_RULES: CategoryRule[] = [
  ["cloudbench", "Software"],
  ["pixelwright", "Software"],
  ["streetcar", "Travel"],
  ["rideshare", "Travel"],
  ["northline", "Travel"],
  ["cafe", "Meals"],
  ["diner", "Meals"],
  ["catering", "Meals"],
  ["paperbird", "Office supplies"],
  ["inkwell", "Office supplies"],
  ["hollow creek", "Utilities"],
  ["adwave", "Marketing"],
  ["shieldline", "Insurance"],
  ["maple court", "Rent"],
].map(([contains, category], i) => ({ id: `rule-${i + 1}`, contains, category }));

/** Monthly targets in cents. Staff welfare and Uncategorized have none, so spending there is unbudgeted. */
export const SAMPLE_BUDGET: Budget = {
  monthlyCents: {
    Rent: 240_000,
    Software: 20_000,
    Utilities: 20_000,
    Insurance: 22_500,
    Travel: 60_000,
    Meals: 50_000,
    "Office supplies": 25_000,
    Marketing: 40_000,
  },
};

type Draft = { day: number; description: string; amountCents: number; csvCategory?: string };

const pick = <T>(rng: () => number, items: readonly T[]): T =>
  items[randInt(rng, 0, items.length - 1)];
const dollars = (rng: () => number, min: number, max: number) =>
  randInt(rng, min * 100, max * 100) + randInt(rng, 0, 99) * 0;

/** Seeded transactions for July to September 2026, identical on every call. Negative amounts are money out. */
export function generateTransactionSample(): Transaction[] {
  const rng = mulberry32(SAMPLE_BUDGET_SEED);
  const dated: (Draft & { month: string })[] = [];
  for (const month of SAMPLE_MONTHS) {
    const add = (d: Draft) => dated.push({ ...d, month });
    // Fixed costs.
    add({ day: 1, description: "Maple Court Properties rent", amountCents: -240_000 });
    add({ day: 3, description: "Cloudbench hosting", amountCents: -14_900 });
    add({ day: 3, description: "Pixelwright design suite", amountCents: -4_200 });
    add({
      day: 12,
      description: "Hollow Creek Power & Water",
      amountCents: -dollars(rng, 140, 210),
    });
    add({ day: 15, description: "Shieldline business insurance", amountCents: -22_500 });
    // Variable spending.
    for (let i = randInt(rng, 2, 4); i > 0; i--) {
      add({
        day: randInt(rng, 2, 28),
        description: pick(rng, ["Streetcar fare", "Rideshare trip", "Northline Rail ticket"]),
        amountCents: -dollars(rng, 18, 320),
      });
    }
    for (let i = randInt(rng, 6, 10); i > 0; i--) {
      add({
        day: randInt(rng, 2, 28),
        description: pick(rng, ["Daily Grind Cafe", "Corner Diner lunch", "Fennel catering order"]),
        amountCents: -dollars(rng, 12, 95),
      });
    }
    for (let i = randInt(rng, 1, 3); i > 0; i--) {
      add({
        day: randInt(rng, 2, 28),
        description: pick(rng, ["Paperbird office supplies", "Inkwell printer toner"]),
        amountCents: -dollars(rng, 25, 140),
      });
    }
    // An explicit category in the file beats the rules.
    add({
      day: randInt(rng, 5, 25),
      description: "Adwave campaign",
      amountCents: -dollars(rng, 80, 300),
      csvCategory: "Marketing",
    });
    add({
      day: randInt(rng, 5, 25),
      description: "Team lunch at Daily Grind Cafe",
      amountCents: -dollars(rng, 60, 180),
      csvCategory: "Staff welfare",
    });
    // Nothing matches these, so they land in Uncategorized.
    for (let i = randInt(rng, 1, 2); i > 0; i--) {
      add({
        day: randInt(rng, 2, 28),
        description: pick(rng, ["Zeta Widgets Ltd", "Cash withdrawal ATM"]),
        amountCents: -dollars(rng, 20, 200),
      });
    }
  }
  // A refund reduces spend in its category.
  dated.push({ month: "2026-09", day: 20, description: "Paperbird refund", amountCents: 3_400 });

  return dated
    .map((d, index) => ({ d, index }))
    .sort(
      (a, b) =>
        `${a.d.month}-${String(a.d.day).padStart(2, "0")}`.localeCompare(
          `${b.d.month}-${String(b.d.day).padStart(2, "0")}`,
        ) || a.index - b.index,
    )
    .map(({ d }, i) => ({
      id: `txn-${i + 2}`, // matches the file-line ids an import of the same data would give
      date: `${d.month}-${String(d.day).padStart(2, "0")}`,
      description: d.description,
      amountCents: d.amountCents,
      ...(d.csvCategory && { csvCategory: d.csvCategory }),
    }));
}
