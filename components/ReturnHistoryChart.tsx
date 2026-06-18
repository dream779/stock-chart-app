'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, AreaData } from 'lightweight-charts';
import { getReturnHistory, type ReturnRange, type ReturnSnapshot } from '@/lib/dca-history';

interface ReturnHistoryChartProps {
  code: string;
  className?: string;
}

const RANGE_OPTIONS: { value: ReturnRange; label: string }[] = [
  { value: '1m', label: '1月' },
  { value: '3m', label: '3月' },
  { value: '6m', label: '6月' },
  { value: '1y', label: '1年' },
  { value: 'all', label: '全部' },
];

export default function ReturnHistoryChart({ code, className }: ReturnHistoryChartProps) {
  const [range, setRange] = useState<ReturnRange>('3m');
  const [data, setData] = useState<ReturnSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getReturnHistory(code, range)
      .then((rows) => {
        if (!cancelled) setData(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '读取失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code, range]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#333333',
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: '#e0e0e0' },
      timeScale: { borderColor: '#e0e0e0', timeVisible: false },
      width: chartContainerRef.current.clientWidth || 600,
      height: 300,
    });

    const series = chart.addAreaSeries({
      lineColor: '#dc2626',
      topColor: 'rgba(220, 38, 38, 0.25)',
      bottomColor: 'rgba(220, 38, 38, 0.02)',
      lineWidth: 2,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const updateSize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };
    window.addEventListener('resize', updateSize);
    const ro = new ResizeObserver(updateSize);
    ro.observe(chartContainerRef.current);
    requestAnimationFrame(updateSize);

    return () => {
      window.removeEventListener('resize', updateSize);
      ro.disconnect();
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current) return;
    if (data.length === 0) {
      seriesRef.current.setData([]);
      return;
    }
    const sorted = [...data].sort(
      (a, b) => new Date(a.snapshotDate).getTime() - new Date(b.snapshotDate).getTime()
    );
    const points: AreaData[] = sorted.map((d) => ({
      time: d.snapshotDate,
      value: Number(d.realizedGain.toFixed(2)),
    }));
    seriesRef.current.setData(points);
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-gray-700">历史收益曲线（已确认）</h4>
        <div className="flex gap-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRange(opt.value)}
              className={`px-2 py-1 text-xs rounded transition ${
                range === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-2 text-xs">
          {error}
        </div>
      )}
      {loading && data.length === 0 ? (
        <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
          加载中...
        </div>
      ) : data.length === 0 ? (
        <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
          还没有数据。持仓存在 + 当日 NAV 已公布 就会写入一条快照
        </div>
      ) : (
        <div ref={chartContainerRef} className="w-full h-[300px]" />
      )}
      <p className="text-xs text-gray-500 mt-2">Y 轴单位：元（每日结算后的累计持有收益）。</p>
    </div>
  );
}
