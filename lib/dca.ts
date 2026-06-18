import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { isWorkday, findWorkday } from 'chinese-days';
import { sql } from './db';
import { getFundQuote, type FundQuoteData } from './eastmoney';

dayjs.extend(utc);
dayjs.extend(timezone);

const LOCAL_TZ = 'Asia/Shanghai';

export type DcaFrequency = 'daily' | 'weekly' | 'monthly';

export interface DcaPlan {
  id: number;
  code: string;
  amountPerPeriod: number;
  frequency: DcaFrequency;
  startDate: string;
  confirmationDays: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DcaTransaction {
  id: number;
  planId: number;
  code: string;
  transactionDate: string;
  amount: number;
  status: 'pending' | 'settled';
  settledAt: string | null;
  navAtSettle: number | null;
  sharesAdded: number | null;
  createdAt: string;
}

export interface DcaTransactionInput {
  planId: number;
  code: string;
  transactionDate: string;
  amount: number;
  status?: 'pending' | 'settled';
}

export interface SettleResult {
  settled: number;
  pendingCount: number;
  pendingAmount: number;
  nav: number | null;
  error?: 'no_plan' | 'no_quote';
}

type DcaPlanRow = {
  id: string;
  code: string;
  amount_per_period: string;
  frequency: string;
  start_date: Date | string;
  confirmation_days: number;
  active: boolean;
  created_at: Date;
  updated_at: Date;
};

type DcaTxRow = {
  id: string;
  plan_id: string;
  code: string;
  transaction_date: Date | string;
  amount: string;
  status: string;
  settled_at: Date | null;
  nav_at_settle: string | null;
  shares_added: string | null;
  created_at: Date;
};

function toDateString(value: Date | string): string {
  if (typeof value === 'string') return value.slice(0, 10);
  return dayjs(value).tz(LOCAL_TZ).format('YYYY-MM-DD');
}

function planFromRow(r: DcaPlanRow): DcaPlan {
  return {
    id: Number(r.id),
    code: r.code,
    amountPerPeriod: Number(r.amount_per_period),
    frequency: r.frequency as DcaFrequency,
    startDate: toDateString(r.start_date),
    confirmationDays: r.confirmation_days,
    active: r.active,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

function txFromRow(r: DcaTxRow): DcaTransaction {
  return {
    id: Number(r.id),
    planId: Number(r.plan_id),
    code: r.code,
    transactionDate: toDateString(r.transaction_date),
    amount: Number(r.amount),
    status: r.status as 'pending' | 'settled',
    settledAt: r.settled_at ? r.settled_at.toISOString() : null,
    navAtSettle: r.nav_at_settle !== null ? Number(r.nav_at_settle) : null,
    sharesAdded: r.shares_added !== null ? Number(r.shares_added) : null,
    createdAt: r.created_at.toISOString(),
  };
}

export function todayString(): string {
  return dayjs().tz(LOCAL_TZ).format('YYYY-MM-DD');
}

export function isTradingDay(dateStr: string): boolean {
  return isWorkday(dateStr);
}

export function addBusinessDays(dateStr: string, n: number): string {
  if (n === 0) return dateStr;
  const result = findWorkday(n, dateStr);
  return dayjs(result).tz(LOCAL_TZ).format('YYYY-MM-DD');
}

export function generatePeriodDates(
  start: string,
  end: string,
  freq: DcaFrequency
): string[] {
  if (freq === 'daily') {
    return generateDaily(start, end);
  }
  if (freq === 'weekly') {
    return generateWeekly(start, end);
  }
  return generateMonthly(start, end);
}

function generateDaily(start: string, end: string): string[] {
  const out: string[] = [];
  let cursor = dayjs(start).tz(LOCAL_TZ);
  const last = dayjs(end).tz(LOCAL_TZ);
  while (cursor.isSame(last) || cursor.isBefore(last)) {
    if (isTradingDay(cursor.format('YYYY-MM-DD'))) {
      out.push(cursor.format('YYYY-MM-DD'));
    }
    cursor = cursor.add(1, 'day');
  }
  return out;
}

function generateWeekly(start: string, end: string): string[] {
  const out: string[] = [];
  let cursor = dayjs(start).tz(LOCAL_TZ);
  const last = dayjs(end).tz(LOCAL_TZ);
  while (cursor.isSame(last) || cursor.isBefore(last)) {
    out.push(cursor.format('YYYY-MM-DD'));
    cursor = cursor.add(7, 'day');
  }
  return out;
}

function generateMonthly(start: string, end: string): string[] {
  const out: string[] = [];
  let cursor = dayjs(start).tz(LOCAL_TZ);
  const last = dayjs(end).tz(LOCAL_TZ);
  while (cursor.isSame(last) || cursor.isBefore(last)) {
    out.push(cursor.format('YYYY-MM-DD'));
    cursor = cursor.add(1, 'month');
  }
  return out;
}

const BACKFILL_DAYS = 365;

export async function getActivePlan(code: string): Promise<DcaPlan | null> {
  const { rows } = await sql<DcaPlanRow>`
    SELECT * FROM dca_plans WHERE code = ${code} AND active = TRUE LIMIT 1
  `;
  if (rows.length === 0) return null;
  return planFromRow(rows[0]);
}

export async function getAllActivePlans(): Promise<DcaPlan[]> {
  const { rows } = await sql<DcaPlanRow>`
    SELECT * FROM dca_plans WHERE active = TRUE ORDER BY code
  `;
  return rows.map(planFromRow);
}

export async function getTransactionsForCode(code: string): Promise<DcaTransaction[]> {
  const { rows } = await sql<DcaTxRow>`
    SELECT * FROM dca_transactions WHERE code = ${code}
    ORDER BY transaction_date ASC
  `;
  return rows.map(txFromRow);
}

export async function getPendingForCode(code: string): Promise<{ count: number; amount: number }> {
  const { rows } = await sql<{ count: string; sum: string | null }>`
    SELECT COUNT(*)::text AS count, COALESCE(SUM(amount), 0)::text AS sum
    FROM dca_transactions
    WHERE code = ${code} AND status = 'pending'
  `;
  return {
    count: Number(rows[0]?.count ?? 0),
    amount: Number(rows[0]?.sum ?? 0),
  };
}

export async function backfillMissingTransactions(
  plan: DcaPlan,
  today: string
): Promise<number> {
  const cutoff = dayjs(plan.startDate)
    .add(BACKFILL_DAYS, 'day')
    .isBefore(today)
    ? dayjs(plan.startDate).add(BACKFILL_DAYS, 'day').format('YYYY-MM-DD')
    : today;

  const expected = generatePeriodDates(plan.startDate, cutoff, plan.frequency);
  if (expected.length === 0) return 0;

  const { rows: existingRows } = await sql<{ transaction_date: Date | string }>`
    SELECT transaction_date FROM dca_transactions WHERE plan_id = ${plan.id}
  `;
  const existing = new Set(existingRows.map((r) => toDateString(r.transaction_date)));
  const missing = expected.filter((d) => !existing.has(d));

  if (missing.length === 0) return 0;

  for (const date of missing) {
    await sql`
      INSERT INTO dca_transactions (plan_id, code, transaction_date, amount, status)
      VALUES (${plan.id}, ${plan.code}, ${date}, ${plan.amountPerPeriod}, 'pending')
      ON CONFLICT (plan_id, transaction_date) DO NOTHING
    `;
  }
  return missing.length;
}

export async function settlePlanForCode(
  code: string,
  today: string,
  quoteOverride?: FundQuoteData | null
): Promise<SettleResult> {
  const plan = await getActivePlan(code);
  if (!plan) {
    return { settled: 0, pendingCount: 0, pendingAmount: 0, nav: null, error: 'no_plan' };
  }

  await backfillMissingTransactions(plan, today);

  const { rows: allPendingRows } = await sql<DcaTxRow>`
    SELECT * FROM dca_transactions
    WHERE plan_id = ${plan.id} AND status = 'pending'
    ORDER BY transaction_date ASC
  `;

  const candidates = allPendingRows.filter((r) => {
    const txDate = toDateString(r.transaction_date);
    const confirmDate = addBusinessDays(txDate, plan.confirmationDays);
    return confirmDate <= today;
  });

  let nav: number | null = null;
  let settledCount = 0;

  if (candidates.length > 0) {
    if (quoteOverride !== undefined) {
      nav = quoteOverride ? quoteOverride.nav : null;
    } else {
      const quote = await getFundQuote(code);
      nav = quote?.nav ?? null;
    }

    if (nav !== null) {
      const { rows: holdingRows } = await sql<{ shares: string; cost_price: string }>`
        SELECT shares, cost_price FROM holdings WHERE code = ${code} LIMIT 1
      `;
      if (holdingRows.length > 0) {
        let currentShares = Number(holdingRows[0].shares);
        let currentCost = Number(holdingRows[0].cost_price);

        for (const row of candidates) {
          const txAmount = Number(row.amount);
          const sharesAdded = txAmount / nav;
          const newShares = currentShares + sharesAdded;
          const newCost =
            newShares > 0 ? (currentCost * currentShares + txAmount) / newShares : currentCost;

          await sql`
            UPDATE dca_transactions
            SET status = 'settled',
                settled_at = NOW(),
                nav_at_settle = ${nav},
                shares_added = ${sharesAdded}
            WHERE id = ${row.id}
          `;

          currentShares = newShares;
          currentCost = newCost;
        }

        await sql`
          UPDATE holdings
          SET shares = ${currentShares},
              cost_price = ${currentCost},
              updated_at = NOW()
          WHERE code = ${code}
        `;
        settledCount = candidates.length;
      }
    }
  } else {
    if (quoteOverride !== undefined) {
      nav = quoteOverride ? quoteOverride.nav : null;
    } else {
      const quote = await getFundQuote(code);
      nav = quote?.nav ?? null;
    }
  }

  if (nav === null) {
    return {
      settled: settledCount,
      pendingCount: 0,
      pendingAmount: 0,
      nav: null,
      error: 'no_quote',
    };
  }

  const pending = await getPendingForCode(code);

  await writeDailySnapshot(code, today, nav);

  return {
    settled: settledCount,
    pendingCount: pending.count,
    pendingAmount: pending.amount,
    nav,
  };
}

export async function writeDailySnapshot(
  code: string,
  snapshotDate: string,
  nav: number
): Promise<void> {
  const { rows: holdingRows } = await sql<{
    shares: string;
    cost_price: string;
  }>`
    SELECT shares, cost_price FROM holdings WHERE code = ${code} LIMIT 1
  `;
  if (holdingRows.length === 0) return;

  const shares = Number(holdingRows[0].shares);
  const costPrice = Number(holdingRows[0].cost_price);
  const marketValue = shares * nav;
  const totalCost = costPrice * shares;
  const realizedGain = marketValue - totalCost;
  const gainRate = totalCost > 0 ? (realizedGain / totalCost) * 100 : 0;

  const pending = await getPendingForCode(code);

  await sql`
    INSERT INTO daily_returns (
      code, snapshot_date, nav, settled_shares, settled_market_value,
      cost_price, total_cost, pending_amount, pending_count,
      realized_gain, gain_rate
    ) VALUES (
      ${code}, ${snapshotDate}, ${nav}, ${shares}, ${marketValue},
      ${costPrice}, ${totalCost}, ${pending.amount}, ${pending.count},
      ${realizedGain}, ${gainRate}
    )
    ON CONFLICT (code, snapshot_date) DO UPDATE SET
      nav = EXCLUDED.nav,
      settled_shares = EXCLUDED.settled_shares,
      settled_market_value = EXCLUDED.settled_market_value,
      cost_price = EXCLUDED.cost_price,
      total_cost = EXCLUDED.total_cost,
      pending_amount = EXCLUDED.pending_amount,
      pending_count = EXCLUDED.pending_count,
      realized_gain = EXCLUDED.realized_gain,
      gain_rate = EXCLUDED.gain_rate,
      recorded_at = NOW()
  `;
}

export interface TodayGainInfo {
  updated: boolean;
  todayGain: number | null;
}

export async function getTodayGainsForCodes(
  codes: string[],
  today: string
): Promise<Record<string, TodayGainInfo>> {
  const result: Record<string, TodayGainInfo> = {};
  for (const code of codes) {
    result[code] = { updated: false, todayGain: null };
  }
  if (codes.length === 0) return result;

  const byCode = await Promise.all(
    codes.map(async (code) => {
      const { rows: codeRows } = await sql<{
        snapshot_date: Date | string;
        realized_gain: string;
      }>`
        SELECT snapshot_date, realized_gain
        FROM daily_returns
        WHERE code = ${code} AND snapshot_date <= ${today}
        ORDER BY snapshot_date DESC
        LIMIT 2
      `;
      return { code, rows: codeRows };
    })
  );

  for (const { code, rows } of byCode) {
    if (rows.length === 0) continue;
    const newest = rows[0];
    if (toDateString(newest.snapshot_date) !== today) continue;
    const prior = rows.length > 1 ? rows[1] : null;
    const delta = prior
      ? Number(newest.realized_gain) - Number(prior.realized_gain)
      : Number(newest.realized_gain);
    result[code] = { updated: true, todayGain: Number(delta.toFixed(2)) };
  }
  return result;
}

export async function getReturnHistory(
  code: string,
  range: '1m' | '3m' | '6m' | '1y' | 'all' = '3m'
): Promise<
  Array<{
    snapshotDate: string;
    nav: number | null;
    settledShares: number;
    settledMarketValue: number;
    costPrice: number;
    totalCost: number;
    pendingAmount: number;
    pendingCount: number;
    realizedGain: number;
    gainRate: number;
  }>
> {
  const today = todayString();
  const start =
    range === '1m'
      ? dayjs(today).subtract(1, 'month').format('YYYY-MM-DD')
      : range === '3m'
        ? dayjs(today).subtract(3, 'month').format('YYYY-MM-DD')
        : range === '6m'
          ? dayjs(today).subtract(6, 'month').format('YYYY-MM-DD')
          : range === '1y'
            ? dayjs(today).subtract(1, 'year').format('YYYY-MM-DD')
            : '1970-01-01';

  const { rows } = await sql<{
    snapshot_date: Date | string;
    nav: string | null;
    settled_shares: string;
    settled_market_value: string;
    cost_price: string;
    total_cost: string;
    pending_amount: string;
    pending_count: number;
    realized_gain: string;
    gain_rate: string;
  }>`
    SELECT snapshot_date, nav, settled_shares, settled_market_value,
           cost_price, total_cost, pending_amount, pending_count,
           realized_gain, gain_rate
    FROM daily_returns
    WHERE code = ${code} AND snapshot_date >= ${start}
    ORDER BY snapshot_date ASC
  `;
  return rows.map((r) => ({
    snapshotDate: toDateString(r.snapshot_date),
    nav: r.nav !== null ? Number(r.nav) : null,
    settledShares: Number(r.settled_shares),
    settledMarketValue: Number(r.settled_market_value),
    costPrice: Number(r.cost_price),
    totalCost: Number(r.total_cost),
    pendingAmount: Number(r.pending_amount),
    pendingCount: r.pending_count,
    realizedGain: Number(r.realized_gain),
    gainRate: Number(r.gain_rate),
  }));
}

export async function saveDcaPlan(input: {
  code: string;
  amountPerPeriod: number;
  frequency: DcaFrequency;
  startDate: string;
  confirmationDays: number;
}): Promise<DcaPlan> {
  const { rows: existing } = await sql<{ id: string }>`
    SELECT id FROM dca_plans WHERE code = ${input.code} AND active = TRUE LIMIT 1
  `;

  if (existing.length > 0) {
    await sql`
      UPDATE dca_plans
      SET amount_per_period = ${input.amountPerPeriod},
          frequency = ${input.frequency},
          start_date = ${input.startDate},
          confirmation_days = ${input.confirmationDays},
          updated_at = NOW()
      WHERE id = ${existing[0].id}
    `;
  } else {
    await sql`
      INSERT INTO dca_plans (code, amount_per_period, frequency, start_date, confirmation_days)
      VALUES (${input.code}, ${input.amountPerPeriod}, ${input.frequency}, ${input.startDate}, ${input.confirmationDays})
    `;
  }

  const plan = await getActivePlan(input.code);
  if (!plan) {
    throw new Error('Failed to save DCA plan');
  }
  return plan;
}

export async function deleteDcaPlan(code: string): Promise<void> {
  await sql`UPDATE dca_plans SET active = FALSE, updated_at = NOW() WHERE code = ${code} AND active = TRUE`;
}
