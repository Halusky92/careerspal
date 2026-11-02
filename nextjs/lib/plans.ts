export const PLAN_PRICES = {
  startPack: 0,
  standard: 79,
  pro: 149,
  elite: 249,
} as const;

export const formatUsd = (amount: number) => `$${amount}`;

export const PLAN_PRICE_LINE =
  `First 10 Standard listings: free, then Standard ${formatUsd(PLAN_PRICES.standard)} / Pro ${formatUsd(PLAN_PRICES.pro)} / Elite ${formatUsd(PLAN_PRICES.elite)}.`;

export const PLAN_PRICE_SHORT =
  `Start pack: first 10 Standard listings free, then ${formatUsd(PLAN_PRICES.standard)} / ${formatUsd(PLAN_PRICES.pro)} / ${formatUsd(PLAN_PRICES.elite)}.`;
