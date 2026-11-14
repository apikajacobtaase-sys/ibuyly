 import { describe, expect, it } from "vitest";
import {
  extractBudget,
  isWithinBudget,
  hasBudgetMatchingOffer,
  prioritizeOffers,
  resolveBudget,
} from "@/lib/concierge-ranking";

describe("Concierge budget extraction", () => {
  it("extracts maximum budgets", () => {
    expect(extractBudget("phones under GH₵1,000")).toEqual({
      minPrice: null,
      maxPrice: 1000,
    });
  });

  it("extracts minimum budgets", () => {
    expect(extractBudget("laptops above 5000")).toEqual({
      minPrice: 5000,
      maxPrice: null,
    });
  });

  it("extracts price ranges", () => {
    expect(extractBudget("between 500 and 1500")).toEqual({
      minPrice: 500,
      maxPrice: 1500,
    });
  });

  it("supports shorthand thousands", () => {
    expect(extractBudget("under 2k")).toEqual({
      minPrice: null,
      maxPrice: 2000,
    });
  });

  it("extracts approximate budgets", () => {
    expect(extractBudget("around 1000")).toEqual({
      minPrice: 800,
      maxPrice: 1200,
    });
  });

  it("returns null limits without a budget", () => {
    expect(extractBudget("recommend a smartphone")).toEqual({
      minPrice: null,
      maxPrice: null,
    });
  });
});

describe("Concierge budget matching", () => {
  const budget = { minPrice: 500, maxPrice: 1000 };

  it("accepts prices inside the range", () => {
    expect(isWithinBudget(750, budget)).toBe(true);
  });

  it("rejects prices outside the range", () => {
    expect(isWithinBudget(1200, budget)).toBe(false);
  });

  it("detects matching seller offers", () => {
    expect(
      hasBudgetMatchingOffer([{ price: 1200 }, { price: 800 }], budget)
    ).toBe(true);
  });

  it("detects when no seller offer matches", () => {
    expect(
      hasBudgetMatchingOffer([{ price: 1200 }, { price: 1500 }], budget)
    ).toBe(false);
  });
});

describe("Concierge seller offer prioritization", () => {
  const offers = [
    { price: 1200, offerScore: 95, seller: "Seller A" },
    { price: 800, offerScore: 70, seller: "Seller B" },
    { price: 900, offerScore: 85, seller: "Seller C" },
  ];

  it("prioritizes budget-compliant offers", () => {
    const result = prioritizeOffers(offers, {
      minPrice: 500,
      maxPrice: 1000,
    });

    expect(result[0].seller).toBe("Seller C");
    expect(result[1].seller).toBe("Seller B");
    expect(result[2].seller).toBe("Seller A");
  });

  it("uses seller score when no offer matches the budget", () => {
    const result = prioritizeOffers(offers, {
      minPrice: 2000,
      maxPrice: 3000,
    });

    expect(result[0].seller).toBe("Seller A");
  });

  it("does not mutate the original offers", () => {
    const original = [...offers];

    prioritizeOffers(offers, {
      minPrice: 500,
      maxPrice: 1000,
    });

    expect(offers).toEqual(original);
  });
});

describe("Conversational budget resolution", () => {
  it("prioritizes the current message budget", () => {
    expect(
      resolveBudget("Actually, under 1000", ["Phones under 2000"])
    ).toEqual({ minPrice: null, maxPrice: 1000 });
  });

  it("carries forward the previous budget", () => {
    expect(
      resolveBudget("Show me Samsung phones", ["Phones under 2000"])
    ).toEqual({ minPrice: null, maxPrice: 2000 });
  });

  it("uses the most recent previous budget", () => {
    expect(
      resolveBudget("Show me laptops", [
        "Phones under 3000",
        "Actually, under 1500",
      ])
    ).toEqual({ minPrice: null, maxPrice: 1500 });
  });

  it("returns no budget when none was specified", () => {
    expect(resolveBudget("Show me phones", [])).toEqual({
      minPrice: null,
      maxPrice: null,
    });
  });
});