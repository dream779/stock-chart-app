import { NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/db';
import {
  getAllActivePlans,
  getPendingForCode,
  saveDcaPlan,
  deleteDcaPlan,
  type DcaFrequency,
} from '@/lib/dca';

export const dynamic = 'force-dynamic';

const CODE_RE = /^\d{6}$/;

export async function GET() {
  try {
    await ensureSchema();
    const plans = await getAllActivePlans();
    const data = await Promise.all(
      plans.map(async (p) => {
        const pending = await getPendingForCode(p.code);
        return {
          ...p,
          pendingCount: pending.count,
          pendingAmount: pending.amount,
        };
      })
    );
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

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      code?: string;
      amountPerPeriod?: number;
      frequency?: string;
      startDate?: string;
      confirmationDays?: number;
    };
    const code = body.code?.trim();
    if (!code || !CODE_RE.test(code)) {
      return NextResponse.json(
        { success: false, error: 'invalid_input', message: '基金代码必须为 6 位数字' },
        { status: 400 }
      );
    }
    if (
      !body.amountPerPeriod ||
      body.amountPerPeriod <= 0 ||
      !['daily', 'weekly', 'monthly'].includes(body.frequency ?? '') ||
      !body.startDate
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'invalid_input',
          message: 'amountPerPeriod / frequency / startDate 必填',
        },
        { status: 400 }
      );
    }
    const confirmationDays = body.confirmationDays ?? 2;
    if (confirmationDays < 1 || confirmationDays > 5) {
      return NextResponse.json(
        {
          success: false,
          error: 'invalid_input',
          message: 'confirmationDays 必须在 1-5 之间',
        },
        { status: 400 }
      );
    }

    await ensureSchema();
    const plan = await saveDcaPlan({
      code,
      amountPerPeriod: body.amountPerPeriod,
      frequency: body.frequency as DcaFrequency,
      startDate: body.startDate,
      confirmationDays,
    });
    return NextResponse.json({ success: true, data: plan });
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
    await deleteDcaPlan(code);
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
