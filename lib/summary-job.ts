import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { isHoliday } from 'chinese-days';
import { sql, ensureSchema } from './db';
import { getFundQuote } from './eastmoney';
import { getFundDetail, type FundDetail } from './fund-detail';
import { searchFundNews, TavilyUpstreamError, TavilyRateLimitError, type TavilyNewsItem } from './tavily';
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

function buildNewsQuery(fundCode: string, fundName: string | undefined, detail: FundDetail | null | undefined): string {
  const topTheme = detail?.themes?.find((t) => t.name)?.name;
  if (fundName && topTheme) return `${fundName} ${topTheme} 近期新闻`;
  if (fundName) return `${fundName} 近期新闻`;
  return `${fundCode} 基金 近期新闻`;
}

async function processOne(
  h: Holding,
  summaryDate: string
): Promise<JobResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  const fundName = h.name ?? '';

  let fundQuote: Awaited<ReturnType<typeof getFundQuote>> | null = null;
  let fundDetail: FundDetail | null = null;
  let news: TavilyNewsItem[] | null = null;

  try {
    const [q, d] = await Promise.allSettled([
      getFundQuote(h.code),
      getFundDetail(h.code),
    ]);
    if (q.status === 'fulfilled') fundQuote = q.value;
    if (d.status === 'fulfilled') fundDetail = d.value;
    if (d.status === 'rejected') {
      console.warn(`[summary-job] getFundDetail(${h.code}) failed:`, d.reason);
    }
  } catch (err) {
    console.warn(`[summary-job] quote/detail fetch error for ${h.code}:`, err);
  }

  try {
    const query = buildNewsQuery(h.code, fundName || undefined, fundDetail);
    news = await searchFundNews({ query, days: 7, maxResults: 5, signal: controller.signal });
  } catch (err) {
    if (err instanceof TavilyRateLimitError) {
      console.warn(`[summary-job] Tavily 429 for ${h.code}: ${err.message}`);
    } else if (err instanceof TavilyUpstreamError) {
      console.warn(`[summary-job] Tavily error for ${h.code}: ${err.message}`);
    } else {
      console.warn(`[summary-job] news fetch error for ${h.code}:`, err);
    }
    news = null;
  }

  try {
    const ai = await summarizeFundContext({
      fundCode: h.code,
      fundName,
      fundQuote: fundQuote
        ? { nav: fundQuote.nav, changePercent: fundQuote.changePercent, navDate: fundQuote.navDate }
        : null,
      fundDetail,
      news,
      enableWebSearch: true,
      signal: controller.signal,
    });
    const quoteJson = fundQuote ? JSON.stringify(fundQuote) : null;
    await sql`
      INSERT INTO fund_summaries (
        code, fund_name, summary_date,
        summary, advice, table_md, raw,
        model, input_tokens, output_tokens,
        status, error_message, fund_quote_json,
        news_count, details_loaded, news_json
      ) VALUES (
        ${h.code}, ${fundName}, ${summaryDate},
        ${ai.sections.summary}, ${ai.sections.advice}, ${ai.sections.table ?? null}, ${ai.raw},
        ${ai.model}, ${ai.usage.inputTokens}, ${ai.usage.outputTokens},
        'success', NULL, ${quoteJson}::jsonb,
        ${ai.newsCount ?? 0}, ${ai.detailsLoaded ?? false}, ${news ? JSON.stringify(news) : null}::jsonb
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
        news_count = EXCLUDED.news_count,
        details_loaded = EXCLUDED.details_loaded,
        news_json = EXCLUDED.news_json,
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
        status, error_message, fund_quote_json,
        news_count, details_loaded, news_json
      ) VALUES (
        ${h.code}, ${fundName}, ${summaryDate},
        '', '', NULL, '',
        'unknown', 0, 0,
        'failed', ${msg}, NULL,
        0, false, NULL
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
        news_count = EXCLUDED.news_count,
        details_loaded = EXCLUDED.details_loaded,
        news_json = EXCLUDED.news_json,
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
  const todayDate = new Date(`${summaryDate}T00:00:00`);
  // dayjs(..., 'Asia/Shanghai').day() returns 0 (Sun) ... 6 (Sat) in BJT
  const bjtDay = dayjs.tz(summaryDate, 'Asia/Shanghai').day();
  const isWeekend = bjtDay === 0 || bjtDay === 6;
  // chinese-days.isHoliday() returns true for both weekends and statutory holidays.
  // Skip only on actual statutory holidays; weekends still generate.
  if (!opts?.forceToday && !isWeekend && isHoliday(todayDate)) {
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