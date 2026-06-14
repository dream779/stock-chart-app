import { NextResponse } from 'next/server';
import { getFundHistory } from '@/lib/eastmoney';

export async function GET(request: Request, { params }: { params: { code: string } }) {
  try {
    const code = decodeURIComponent(params.code);
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '1y';

    const data = await getFundHistory(code, range);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Fund historical API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取基金历史净值失败',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
