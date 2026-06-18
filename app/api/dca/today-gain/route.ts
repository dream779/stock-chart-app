import { NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/db';
import { getTodayGainsForCodes, todayString } from '@/lib/dca';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { codes?: unknown };
    const codes = Array.isArray(body.codes)
      ? (body.codes.filter((c): c is string => typeof c === 'string' && c.trim().length > 0) as string[])
      : [];

    await ensureSchema();
    const data = await getTodayGainsForCodes(codes, todayString());
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
