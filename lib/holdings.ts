export interface Holding {
  code: string;
  name: string;
  shares: number;
  amount: number;
  costPrice: number;
  pendingAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface HoldingWithQuote extends Holding {
  quoteName?: string;
  nav?: number;
  estimatedNav?: number | null;
  changePercent?: number | null;
}

export interface HoldingCalcs {
  totalCost: number;
  holdingGain: number;
  gainRate: number;
  estimatedGain: number | null;
  totalAssets: number;
}

export function calculateHolding(holding: HoldingWithQuote): Omit<HoldingCalcs, 'totalAssets'> {
  const totalCost = holding.costPrice * holding.shares;
  const holdingGain = holding.amount - totalCost;
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
  };
}

export function calculateSummary(holdings: HoldingWithQuote[]): HoldingCalcs {
  const totalAssets = holdings.reduce((sum, h) => sum + h.amount + h.pendingAmount, 0);
  const totalCost = holdings.reduce((sum, h) => sum + h.costPrice * h.shares, 0);
  const totalHoldingAmount = holdings.reduce((sum, h) => sum + h.amount, 0);
  const holdingGain = totalHoldingAmount - totalCost;
  const gainRate = totalCost > 0 ? (holdingGain / totalCost) * 100 : 0;

  return {
    totalAssets: Number(totalAssets.toFixed(2)),
    totalCost: Number(totalCost.toFixed(2)),
    holdingGain: Number(holdingGain.toFixed(2)),
    gainRate: Number(gainRate.toFixed(2)),
    estimatedGain: null,
  };
}
