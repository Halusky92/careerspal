export const PLAN_PRICES = {
  startPack: 0,
  test: 1,
  standard: 79,
  pro: 149,
  elite: 249,
} as const;

export const formatUsd = (amount: number) => `$${amount}`;

export const PLAN_PRICE_LINE =
  `First Standard listing per company and account is free, then Standard ${formatUsd(PLAN_PRICES.standard)} / Featured Pro ${formatUsd(PLAN_PRICES.pro)}.`;

export const PLAN_PRICE_SHORT =
  `Start pack: 1 free Standard listing per company and account, then ${formatUsd(PLAN_PRICES.standard)} / ${formatUsd(PLAN_PRICES.pro)}.`;
