"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type Time,
} from "lightweight-charts";

export interface ChartCandle {
  time: string; // "YYYY-MM-DD"
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number; // in mil CZK or count
}

const TIMEFRAMES = [
  { label: "1R", months: 12 },
  { label: "3R", months: 36 },
  { label: "Vše", months: 0 },
] as const;

type TFLabel = (typeof TIMEFRAMES)[number]["label"];

function filterByTimeframe(candles: ChartCandle[], months: number): ChartCandle[] {
  if (months === 0) return candles;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return candles.filter(c => c.time >= cutoffStr);
}

export default function CandlestickChart({
  candles,
  height = 380,
  defaultTimeframe = "1R",
  askingPrice,
  volumeLabel = "Volume",
  tf: tfProp,
  onTfChange,
}: {
  candles: ChartCandle[];
  height?: number;
  defaultTimeframe?: TFLabel;
  askingPrice?: number | null;
  volumeLabel?: string;
  tf?: TFLabel;
  onTfChange?: (tf: TFLabel, months: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [tfInternal, setTfInternal] = useState<TFLabel>(defaultTimeframe);
  const tf = tfProp ?? tfInternal;

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return;

    const tfDef = TIMEFRAMES.find(t => t.label === tf)!;
    const filtered = filterByTimeframe(candles, tfDef.months);
    if (filtered.length === 0) return;

    const hasVolume = filtered.some(c => (c.volume ?? 0) > 0);

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#6b7280",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#1e2230" },
        horzLines: { color: "#1e2230" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: "#2a2e3d",
        scaleMargins: { top: 0.05, bottom: hasVolume ? 0.28 : 0.05 },
      },
      timeScale: {
        borderColor: "#2a2e3d",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Price line
    const priceSeries = chart.addSeries(LineSeries, {
      color: "#22c55e",
      lineWidth: 2,
      priceScaleId: "right",
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      lastValueVisible: true,
      priceLineVisible: false,
    });

    priceSeries.setData(
      filtered.map(c => ({ time: c.time as Time, value: c.close }))
    );

    // Asking price as a separate flat line series — always included in auto-scale
    if (askingPrice) {
      const askingSeries = chart.addSeries(LineSeries, {
        color: "#818cf8",
        lineWidth: 1,
        lineStyle: 2, // dashed
        priceScaleId: "right",
        lastValueVisible: true,
        priceLineVisible: false,
        title: "Nabídka",
        crosshairMarkerVisible: false,
      });
      askingSeries.setData(
        filtered.map(c => ({ time: c.time as Time, value: askingPrice }))
      );
    }

    // Volume bars overlaid at the bottom
    if (hasVolume) {
      const volSeries = chart.addSeries(HistogramSeries, {
        color: "#22c55e55",
        priceFormat: { type: "volume" },
        priceScaleId: "vol",
      });

      chart.priceScale("vol").applyOptions({
        scaleMargins: { top: 0.78, bottom: 0 },
        visible: false,
      });

      volSeries.setData(
        filtered.map(c => ({
          time: c.time as Time,
          value: c.volume ?? 0,
          color: c.close >= c.open ? "#22c55e55" : "#ef444455",
        }))
      );
    }

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(entries => {
      chart.applyOptions({ width: entries[0].contentRect.width });
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [candles, tf, height, askingPrice]);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        {TIMEFRAMES.map(t => (
          <button
            key={t.label}
            onClick={() => {
              setTfInternal(t.label);
              onTfChange?.(t.label, t.months);
            }}
            className={`rounded px-2.5 py-0.5 text-xs font-medium transition-colors ${
              tf === t.label
                ? "bg-accent text-white"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
        {volumeLabel && (
          <span className="ml-auto text-xs text-muted">{volumeLabel}</span>
        )}
      </div>
      <div ref={containerRef} style={{ height }} />
    </div>
  );
}
