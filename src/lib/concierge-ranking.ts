  export type Budget = {
  minPrice: number | null;
  maxPrice: number | null;
};

export function extractBudget(message: string): Budget {
  const normalized = message
    .toLowerCase()
    .replace(/,/g, "")
    .replace(/(\d+(?:\.\d+)?)\s*k\b/g, (_, value) =>
      String(Number(value) * 1000)
    );

  const numbers = [...normalized.matchAll(/\d+(?:\.\d+)?/g)]
    .map((match) => Number(match[0]))
    .filter(Number.isFinite);

  if (numbers.length === 0) {
    return { minPrice: null, maxPrice: null };
  }

  const rangeMatch = normalized.match(
    /between\s+(\d+(?:\.\d+)?)\s+(?:and|to|-)\s+(\d+(?:\.\d+)?)/i
  );

  if (rangeMatch) {
    return {
      minPrice: Math.min(Number(rangeMatch[1]), Number(rangeMatch[2])),
      maxPrice: Math.max(Number(rangeMatch[1]), Number(rangeMatch[2])),
    };
  }

  if (/\b(under|below|less than|maximum|max|at most|up to|within)\b/.test(normalized)) {
    return { minPrice: null, maxPrice: numbers[0] };
  }

  if (/\b(over|above|more than|minimum|min|at least)\b/.test(normalized)) {
    return { minPrice: numbers[0], maxPrice: null };
  }

  if (/\b(around|about|approximately|roughly)\b/.test(normalized)) {
    return {
      minPrice: numbers[0] * 0.8,
      maxPrice: numbers[0] * 1.2,
    };
  }

  return { minPrice: null, maxPrice: null };
}

export function resolveBudget(
  currentMessage: string,
  previousMessages: string[]
): Budget {
  const currentBudget = extractBudget(currentMessage);

  if (
    currentBudget.minPrice !== null ||
    currentBudget.maxPrice !== null
  ) {
    return currentBudget;
  }

  for (const message of [...previousMessages].reverse()) {
    const budget = extractBudget(message);

    if (budget.minPrice !== null || budget.maxPrice !== null) {
      return budget;
    }
  }

  return { minPrice: null, maxPrice: null };
}

export function isWithinBudget(price: number, budget: Budget): boolean {
  return (
    (budget.minPrice === null || price >= budget.minPrice) &&
    (budget.maxPrice === null || price <= budget.maxPrice)
  );
}

export function hasBudgetMatchingOffer(
  offers: { price: number }[],
  budget: Budget
): boolean {
  return offers.some((offer) => isWithinBudget(offer.price, budget));
}

export function prioritizeOffers<T extends { price: number; offerScore: number }>(
  offers: T[],
  budget: Budget
): T[] {
  return [...offers].sort((a, b) => {
    const aMatches = isWithinBudget(a.price, budget);
    const bMatches = isWithinBudget(b.price, budget);

    if (aMatches !== bMatches) {
      return Number(bMatches) - Number(aMatches);
    }

    return b.offerScore - a.offerScore;
  });
}