import { unstable_noStore as noStore } from 'next/cache';
import NavBar from '@/components/NavBar';
import SummaryCard from '@/components/SummaryCard';
import RegenerateButton from '@/components/RegenerateButton';
import { sql, ensureSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface FundItem {
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
  funds: FundItem[];
}

interface Row {
  summary_date: string | Date;
  fund_count: string;
  funds: FundItem[];
}

function todayBJTString(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function loadCards(): Promise<Card[]> {
  noStore();
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
  const today = todayBJTString();
  return rows.map((r) => {
    let dateStr: string;
    if (typeof r.summary_date === 'string') {
      dateStr = r.summary_date.slice(0, 10);
    } else {
      dateStr = new Date(r.summary_date.getTime() + 8 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
    }
    return {
      summaryDate: dateStr,
      isToday: dateStr === today,
      fundCount: Number(r.fund_count),
      funds: r.funds,
    };
  });
}

export default async function SummariesPage() {
  const cards = await loadCards();

  return (
    <main className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">每日总结</h1>
              <p className="text-xs text-gray-500 mt-1">
                每天北京时间 18:00 自动生成（法定节假日除外，周末照常），保留最近 14 天
              </p>
            </div>
            <RegenerateButton />
          </div>
        </div>

        {cards.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500 text-sm">
            暂无总结。明日 18:00 自动生成；也可点击右上角「重跑今日」立即生成。
          </div>
        ) : (
          <div className="space-y-4">
            {cards.map((card) => (
              <SummaryCard key={card.summaryDate} card={card} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}