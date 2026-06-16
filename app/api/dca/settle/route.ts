import { NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/db';
import { settlePlanForCode, todayString } from '@/lib/dca';

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
    const result = await settlePlanForCode(code, todayString());
    return NextResponse.json({ success: true, data: result });
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
