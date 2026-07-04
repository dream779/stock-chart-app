import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { isHoliday } from 'chinese-days';
import { sql, ensureSchema } from './db';
import { getFundQuote } from './eastmoney';
import { summarizeFundContext } from './ai';

dayjs.extend(utc);
dayjs.extend(timezone);

export interface JobResult {
  code: string;
  status: 'success' | 'failed';
  error?: string;
}

export interface JobSummary {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: 'holiday' | 'no_holdings' | 'none';
  results: JobResult[];
}

export function todayBJT(): string {
  return dayjs().tz('Asia/Shanghai').format('YYYY-MM-DD');
}

interface Holding { code: string; name: string | null; }

async function processOne(
  h: Holding,
  summaryDate: string
): Promise<JobResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  const fundName = h.name ?? '';
  try {
    const quote = await getFundQuote(h.code).catch(() => null);
    const ai = await summarizeFundContext({
      fundCode: h.code,
      fundName,
      fundQuote: quote
        ? { nav: quote.nav, changePercent: quote.changePercent, navDate: quote.navDate }
        : null,
      enableWebSearch: true,
      signal: controller.signal,
    });
    const quoteJson = quote ? JSON.stringify(quote) : null;
    await sql`
      INSERT INTO fund_summaries (
        code, fund_name, summary_date,
        summary, advice, table_md, raw,
        model, input_tokens, output_tokens,
        status, error_message, fund_quote_json
      ) VALUES (
        ${h.code}, ${fundName}, ${summaryDate},
        ${ai.sections.summary}, ${ai.sections.advice}, ${ai.sections.table ?? null}, ${ai.raw},
        ${ai.model}, ${ai.usage.inputTokens}, ${ai.usage.outputTokens},
        'success', NULL, ${quoteJson}::jsonb
      )
      ON CONFLICT (code, summary_date) DO UPDATE SET
        summary = EXCLUDED.summary,
        advice = EXCLUDED.advice,
        table_md = EXCLUDED.table_md,
        raw = EXCLUDED.raw,
        model = EXCLUDED.model,
        input_tokens = EXCLUDED.input_tokens,
        output_tokens = EXCLUDED.output_tokens,
        status = EXCLUDED.status,
        error_message = EXCLUDED.error_message,
        fund_quote_json = EXCLUDED.fund_quote_json,
        created_at = NOW()
    `;
    return { code: h.code, status: 'success' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await sql`
      INSERT INTO fund_summaries (
        code, fund_name, summary_date,
        summary, advice, table_md, raw,
        model, input_tokens, output_tokens,
        status, error_message, fund_quote_json
      ) VALUES (
        ${h.code}, ${fundName}, ${summaryDate},
        '', '', NULL, '',
        'unknown', 0, 0,
        'failed', ${msg}, NULL
      )
      ON CONFLICT (code, summary_date) DO UPDATE SET
        summary = EXCLUDED.summary,
        advice = EXCLUDED.advice,
        table_md = EXCLUDED.table_md,
        raw = EXCLUDED.raw,
        model = EXCLUDED.model,
        input_tokens = EXCLUDED.input_tokens,
        output_tokens = EXCLUDED.output_tokens,
        status = EXCLUDED.status,
        error_message = EXCLUDED.error_message,
        fund_quote_json = EXCLUDED.fund_quote_json,
        created_at = NOW()
    `;
    return { code: h.code, status: 'failed', error: msg };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function cleanupOld(today: string): Promise<number> {
  const cutoff = dayjs(today).subtract(14, 'day').format('YYYY-MM-DD');
  const r = await sql`DELETE FROM fund_summaries WHERE summary_date < ${cutoff}`;
  return r.rowCount ?? 0;
}

export async function runDailySummarize(opts?: {
  forceToday?: boolean;
}): Promise<JobSummary> {
  await ensureSchema();
  const summaryDate = todayBJT();
  if (!opts?.forceToday && isHoliday(new Date(`${summaryDate}T00:00:00`))) {
    return { processed: 0, succeeded: 0, failed: 0, skipped: 'holiday', results: [] };
  }
  const { rows: holdings } = await sql<Holding>`SELECT code, name FROM holdings`;
  if (holdings.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0, skipped: 'no_holdings', results: [] };
  }
  const settled = await Promise.allSettled(
    holdings.map((h) => processOne({ code: h.code, name: h.name }, summaryDate))
  );
  const results: JobResult[] = settled.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { code: holdings[i].code, status: 'failed', error: String(r.reason) }
  );
  const succeeded = results.filter((r) => r.status === 'success').length;
  const failed = results.length - succeeded;
  await cleanupOld(summaryDate);
  return { processed: results.length, succeeded, failed, skipped: 'none', results };
}