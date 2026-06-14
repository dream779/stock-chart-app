import { NextResponse } from 'next/server';
import { getQuote } from '@/lib/yahoo';

export async function GET(request: Request, { params }: { params: { symbol: string } }) {
  try {
    const symbol = decodeURIComponent(params.symbol);
    const data = await getQuote(symbol);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Quote API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取行情数据失败',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
