import { runDailySummarize } from '@/lib/summary-job';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  try {
    const result = await runDailySummarize({ forceToday: true });
    return Response.json({ success: true, data: result });
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