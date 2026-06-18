export interface Holding {
  code: string;
  name: string;
  shares: number;
  costPrice: number;
  createdAt: string;
  updatedAt: string;
}

export interface HoldingWithQuote extends Holding {
  quoteName?: string;
  nav?: number;
  estimatedNav?: number | null;
  changePercent?: number | null;
  pendingAmount?: number;
  pendingCount?: number;
  hasDcaPlan?: boolean;
  dcaFrequency?: 'daily' | 'weekly' | 'monthly';
  dcaConfirmationDays?: number;
  todayGain?: { updated: boolean; todayGain: number | null };
}

export interface HoldingCalcs {
  totalCost: number;
  holdingGain: number;
  gainRate: number;
  estimatedGain: number | null;
  marketValue: number;
}

export function calculateHolding(holding: HoldingWithQuote): HoldingCalcs {
  const totalCost = holding.costPrice * holding.shares;
  const nav = holding.nav ?? 0;
  const marketValue = holding.shares * nav;
  const holdingGain = marketValue - totalCost;
  const gainRate = totalCost > 0 ? (holdingGain / totalCost) * 100 : 0;

  let estimatedGain: number | null = null;
  if (
    holding.estimatedNav !== null &&
    holding.estimatedNav !== undefined &&
    holding.nav !== undefined
  ) {
    estimatedGain = holding.shares * (holding.estimatedNav - holding.nav);
  }

  return {
    totalCost: Number(totalCost.toFixed(2)),
    holdingGain: Number(holdingGain.toFixed(2)),
    gainRate: Number(gainRate.toFixed(2)),
    estimatedGain: estimatedGain !== null ? Number(estimatedGain.toFixed(2)) : null,
    marketValue: Number(marketValue.toFixed(2)),
  };
}

export interface SummaryCalcs {
  totalAssets: number;
  totalCost: number;
  totalMarketValue: number;
  holdingGain: number;
  gainRate: number;
  totalPending: number;
  totalPendingCount: number;
  hasAnyNav: boolean;
  totalTodayGain: number;
  hasAnyTodayGain: boolean;
}

export function calculateSummary(holdings: HoldingWithQuote[]): SummaryCalcs {
  const totalMarketValue = holdings.reduce(
    (sum, h) => sum + (h.nav ? h.shares * h.nav : 0),
    0
  );
  const totalCost = holdings.reduce((sum, h) => sum + h.costPrice * h.shares, 0);
  const totalPending = holdings.reduce((sum, h) => sum + (h.pendingAmount ?? 0), 0);
  const totalPendingCount = holdings.reduce((sum, h) => sum + (h.pendingCount ?? 0), 0);
  const holdingGain = totalMarketValue - totalCost;
  const gainRate = totalCost > 0 ? (holdingGain / totalCost) * 100 : 0;
  const totalAssets = totalMarketValue + totalPending;
  const hasAnyNav = holdings.some((h) => h.nav !== undefined);

  const totalTodayGain = holdings.reduce(
    (sum, h) =>
      sum + (h.todayGain?.updated && h.todayGain.todayGain !== null ? h.todayGain.todayGain : 0),
    0
  );
  const hasAnyTodayGain = holdings.some((h) => h.todayGain?.updated);

  return {
    totalAssets: Number(totalAssets.toFixed(2)),
    totalCost: Number(totalCost.toFixed(2)),
    totalMarketValue: Number(totalMarketValue.toFixed(2)),
    holdingGain: Number(holdingGain.toFixed(2)),
    gainRate: Number(gainRate.toFixed(2)),
    totalPending: Number(totalPending.toFixed(2)),
    totalPendingCount,
    hasAnyNav,
    totalTodayGain: Number(totalTodayGain.toFixed(2)),
    hasAnyTodayGain,
  };
}
