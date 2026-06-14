import { NextResponse } from 'next/server';
import { getHistorical } from '@/lib/yahoo';

export async function GET(request: Request, { params }: { params: { symbol: string } }) {
  try {
    const symbol = decodeURIComponent(params.symbol);
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '1y';

    const data = await getHistorical(symbol, range);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Historical API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取历史数据失败',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
