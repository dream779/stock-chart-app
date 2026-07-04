import { NextResponse } from 'next/server';
import {
  summarizeFundContext,
  type SummarizeInput,
  MissingEnvError,
  AiUpstreamError,
  AiParseError,
} from '@/lib/ai';

export const dynamic = 'force-dynamic';

const FUND_CODE_RE = /^\d{6}$/;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<SummarizeInput>;
    const fundCode = body.fundCode?.trim();
    if (!fundCode || !FUND_CODE_RE.test(fundCode)) {
      return NextResponse.json(
        { success: false, error: 'invalid_input', message: 'fundCode 必须为 6 位数字' },
        { status: 400 }
      );
    }

    const input: SummarizeInput = {
      fundCode,
      fundName: body.fundName?.trim() || undefined,
      context: body.context?.trim() || undefined,
    };

    const data = await summarizeFundContext(input);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    if (err instanceof MissingEnvError) {
      return NextResponse.json(
        { success: false, error: 'missing_env', message: err.message },
        { status: 500 }
      );
    }
    if (err instanceof AiUpstreamError) {
      return NextResponse.json(
        { success: false, error: 'ai_upstream_error', message: err.message },
        { status: 502 }
      );
    }
    if (err instanceof AiParseError) {
      return NextResponse.json(
        {
          success: false,
          error: 'ai_parse_error',
          message: `${err.message}; raw=${err.raw.slice(0, 500)}`,
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: 'internal_error',
        message: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 }
    );
  }
}