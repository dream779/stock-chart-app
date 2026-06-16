import { NextResponse } from 'next/server';
import { ensureSchema, sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

const CODE_RE = /^\d{6}$/;

export async function GET() {
  try {
    await ensureSchema();
    const { rows } = await sql<{ code: string }>`
      SELECT code FROM watchlist ORDER BY added_at DESC
    `;
    return NextResponse.json({ success: true, data: rows.map((r) => r.code) });
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

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { code?: string };
    const code = body.code?.trim();
    if (!code || !CODE_RE.test(code)) {
      return NextResponse.json(
        { success: false, error: 'invalid_input', message: '基金代码必须为 6 位数字' },
        { status: 400 }
      );
    }

    await ensureSchema();
    await sql`
      INSERT INTO watchlist (code) VALUES (${code})
      ON CONFLICT (code) DO NOTHING
    `;
    return NextResponse.json({ success: true });
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

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    if (!code) {
      return NextResponse.json(
        { success: false, error: 'invalid_input', message: 'code is required' },
        { status: 400 }
      );
    }

    await ensureSchema();
    await sql`DELETE FROM watchlist WHERE code = ${code}`;
    return NextResponse.json({ success: true });
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
