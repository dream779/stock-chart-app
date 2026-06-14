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
  className?: string;
}

function formatNumber(num: number): string {
  return num.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export default function Chart({ data, title, stats, className }: ChartProps) {
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
      height: chartContainerRef.current.clientHeight,
    });

    const series = chart.addAreaSeries({
      lineColor: "#2563eb",
      topColor: "rgba(37, 99, 235, 0.3)",
      bottomColor: "rgba(37, 99, 235, 0.05)",
      lineWidth: 2,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const updateSize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener("resize", updateSize);

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      window.removeEventListener("resize", updateSize);
      resizeObserver.disconnect();
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
    <div className={`flex flex-col h-full ${className || ""}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
        {title && <h3 className="text-base font-semibold text-gray-900">{title}</h3>}
        {stats && (
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-gray-900">
              {formatNumber(stats.currentValue)}
            </span>
            <span
              className={`text-sm font-medium px-2 py-0.5 rounded ${
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
      <div ref={chartContainerRef} className="flex-1 min-h-0" />
    </div>
  );
}
