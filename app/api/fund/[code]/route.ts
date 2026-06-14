import { NextResponse } from 'next/server';
import { getFundQuote } from '@/lib/eastmoney';

export async function GET(request: Request, { params }: { params: { code: string } }) {
  try {
    const code = decodeURIComponent(params.code);
    const data = await getFundQuote(code);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Fund quote API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取基金数据失败',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
