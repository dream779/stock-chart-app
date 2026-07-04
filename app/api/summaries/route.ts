import { sql, ensureSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface FundSummaryItem {
  id: number;
  code: string;
  fundName: string;
  summary: string;
  advice: string;
  tableMd: string | null;
  status: 'success' | 'failed';
  errorMessage: string | null;
  createdAt: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

interface Card {
  summaryDate: string;
  isToday: boolean;
  fundCount: number;
  funds: FundSummaryItem[];
}

interface Row {
  summary_date: string;
  fund_count: string;
  funds: FundSummaryItem[];
}

export async function GET() {
  try {
    await ensureSchema();
    const { rows } = await sql<Row>`
      SELECT summary_date,
             COUNT(*)::text AS fund_count,
             COALESCE(json_agg(json_build_object(
               'id', id,
               'code', code,
               'fundName', fund_name,
               'summary', summary,
               'advice', advice,
               'tableMd', table_md,
               'status', status,
               'errorMessage', error_message,
               'createdAt', created_at,
               'model', model,
               'inputTokens', input_tokens,
               'outputTokens', output_tokens
             ) ORDER BY code), '[]'::json) AS funds
      FROM fund_summaries
      WHERE summary_date >= CURRENT_DATE - INTERVAL '14 days'
      GROUP BY summary_date
      ORDER BY summary_date DESC
    `;
    const nowMs = Date.now();
    const todayBJT = new Date(nowMs + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const cards: Card[] = rows.map((r) => {
      let dateStr: string;
      if (typeof r.summary_date === 'string') {
        dateStr = r.summary_date.slice(0, 10);
      } else {
        // @vercel/postgres returns DATE as a Date object at UTC midnight of that day.
        // Shift +8h to align with BJT calendar date.
        dateStr = new Date(r.summary_date.getTime() + 8 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);
      }
      return {
        summaryDate: dateStr,
        isToday: dateStr === todayBJT,
        fundCount: Number(r.fund_count),
        funds: r.funds,
      };
    });
    return Response.json({ success: true, data: { retentionDays: 14, cards } });
  } catch (err) {
    return Response.json(
      {
        success: false,
        error: 'internal_error',
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}