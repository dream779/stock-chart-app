import { NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/db';
import { writeDailySnapshot, todayString } from '@/lib/dca';
import { getFundQuote } from '@/lib/eastmoney';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { code?: string };
    const code = body.code?.trim();
    if (!code) {
      return NextResponse.json(
        { success: false, error: 'invalid_input', message: 'code is required' },
        { status: 400 }
      );
    }

    await ensureSchema();
    const quote = await getFundQuote(code);
    const nav = quote?.nav ?? null;
    if (nav === null) {
      return NextResponse.json({
        success: true,
        data: { written: false, reason: 'no_quote' },
      });
    }

    await writeDailySnapshot(code, todayString(), nav);
    return NextResponse.json({ success: true, data: { written: true } });
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
