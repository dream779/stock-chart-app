import { NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/db';
import { getReturnHistory } from '@/lib/dca';

export const dynamic = 'force-dynamic';

type Range = '1m' | '3m' | '6m' | '1y' | 'all';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    if (!code) {
      return NextResponse.json(
        { success: false, error: 'invalid_input', message: 'code is required' },
        { status: 400 }
      );
    }
    const rangeParam = (searchParams.get('range') ?? '3m') as Range;
    const range: Range = ['1m', '3m', '6m', '1y', 'all'].includes(rangeParam)
      ? rangeParam
      : '3m';

    await ensureSchema();
    const data = await getReturnHistory(code, range);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: 'db_error',
        message: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 }
    );
  }
}
