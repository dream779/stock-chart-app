import { NextResponse } from 'next/server';
import { getFundQuote } from '@/lib/eastmoney';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { code: string } }) {
  try {
    const code = decodeURIComponent(params.code);
    const data = await getFundQuote(code);
    return NextResponse.json(
      { success: true, data },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error) {
    console.error('Fund quote API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取基金数据失败',
        message: error instanceof Error ? error.message : String(error),
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  }
}
