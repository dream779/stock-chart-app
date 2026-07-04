import { runDailySummarize } from '@/lib/summary-job';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json(
      { success: false, error: 'missing_env', message: 'CRON_SECRET 未配置' },
      { status: 500 }
    );
  }
  if (auth !== `Bearer ${secret}`) {
    return Response.json(
      { success: false, error: 'unauthorized', message: '鉴权失败' },
      { status: 401 }
    );
  }
  try {
    const result = await runDailySummarize();
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