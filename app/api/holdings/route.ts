import { NextResponse } from 'next/server';
import { ensureSchema, sql } from '@/lib/db';
import type { Holding } from '@/lib/holdings';

export const dynamic = 'force-dynamic';

type Row = {
  code: string;
  name: string;
  shares: string;
  amount: string;
  cost_price: string;
  pending_amount: string;
  created_at: Date;
  updated_at: Date;
};

const fromRow = (r: Row): Holding => ({
  code: r.code,
  name: r.name,
  shares: Number(r.shares),
  costPrice: Number(r.cost_price),
  createdAt: r.created_at.toISOString(),
  updatedAt: r.updated_at.toISOString(),
});

export async function GET() {
  try {
    await ensureSchema();
    const { rows } = await sql<Row>`
      SELECT * FROM holdings ORDER BY updated_at DESC
    `;
    return NextResponse.json({ success: true, data: rows.map(fromRow) });
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
    const body = (await req.json()) as Partial<Holding>;
    if (!body.code || !body.name) {
      return NextResponse.json(
        { success: false, error: 'invalid_input', message: 'code and name are required' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const createdAt = body.createdAt ?? now;

    await ensureSchema();
    await sql`
      INSERT INTO holdings (
        code, name, shares, amount, cost_price, pending_amount, created_at, updated_at
      ) VALUES (
        ${body.code},
        ${body.name},
        ${body.shares ?? 0},
        0,
        ${body.costPrice ?? 0},
        0,
        ${createdAt},
        NOW()
      )
      ON CONFLICT (code) DO UPDATE SET
        name           = EXCLUDED.name,
        shares         = EXCLUDED.shares,
        cost_price     = EXCLUDED.cost_price,
        updated_at     = NOW()
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
    await sql`DELETE FROM holdings WHERE code = ${code}`;
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
