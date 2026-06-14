import { NextResponse } from "next/server";
import { getQuote } from "@/lib/yahoo";

const INDICES = [
  { symbol: "^GSPC", name: "标普 500" },
  { symbol: "^NDX", name: "纳斯达克 100" },
];

export async function GET() {
  try {
    const results = await Promise.all(
      INDICES.map(async (item) => {
        try {
          const quote = await getQuote(item.symbol);
          return { ...quote, displayName: item.name };
        } catch (error) {
          console.error(`Failed to fetch ${item.symbol}:`, error);
          return {
            symbol: item.symbol,
            displayName: item.name,
            name: item.name,
            price: 0,
            change: 0,
            changePercent: 0,
            previousClose: 0,
            marketState: "ERROR",
            currency: "USD",
            lastUpdated: new Date().toISOString(),
            error: true,
          };
        }
      })
    );

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error("Indices API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "获取指数数据失败",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
