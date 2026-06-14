"use client";

import { useEffect, useRef } from "react";
import { createChart, ColorType, IChartApi, ISeriesApi, AreaData } from "lightweight-charts";

interface ChartProps {
  data: { time: string; value: number }[];
  title?: string;
  stats?: {
    currentValue: number;
    changePercent: number;
  };
}

function formatNumber(num: number): string {
  return num.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export default function Chart({ data, title, stats }: ChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#333333",
      },
      grid: {
        vertLines: { color: "#f0f0f0" },
        horzLines: { color: "#f0f0f0" },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: "#e0e0e0",
      },
      timeScale: {
        borderColor: "#e0e0e0",
        timeVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: 360,
    });

    const series = chart.addAreaSeries({
      lineColor: "#2563eb",
      topColor: "rgba(37, 99, 235, 0.3)",
      bottomColor: "rgba(37, 99, 235, 0.05)",
      lineWidth: 2,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (seriesRef.current && data.length > 0) {
      const sortedData = [...data].sort(
        (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
      );
      seriesRef.current.setData(sortedData as AreaData[]);
      chartRef.current?.timeScale().fitContent();
    }
  }, [data]);

  const isPositive = stats ? stats.changePercent >= 0 : true;

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
        {stats && (
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold text-gray-900">
              {formatNumber(stats.currentValue)}
            </span>
            <span
              className={`text-sm font-medium px-2 py-1 rounded ${
                isPositive
                  ? "bg-red-50 text-red-600"
                  : "bg-green-50 text-green-600"
              }`}
            >
              {isPositive ? "+" : ""}
              {stats.changePercent.toFixed(2)}%
            </span>
          </div>
        )}
      </div>
      <div ref={chartContainerRef} className="w-full" />
    </div>
  );
}
