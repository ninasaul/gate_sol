'use client';

import { useEffect, useRef } from 'react';
import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { fmtUsd, hms } from '@/lib/format';
import type { DashboardState } from '@/lib/dashboard-types';
import { getChartThemeColors, type ChartThemeColors } from '@/lib/theme';
import { useTheme } from '@/lib/use-theme';

interface TrendChartProps {
  trend: DashboardState['trend'];
  equity: DashboardState['equity'];
}

function applyChartChrome(
  chart: IChartApi,
  realizedSeries: ISeriesApi<'Line'>,
  zeroLine: IPriceLine | null,
  colors: ChartThemeColors,
): void {
  chart.applyOptions({
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' },
      textColor: colors.textColor,
    },
    grid: {
      vertLines: { color: colors.gridColor },
      horzLines: { color: colors.gridColor },
    },
    crosshair: {
      vertLine: {
        color: colors.crosshairVert,
        labelBackgroundColor: colors.crosshairLabel,
      },
      horzLine: {
        color: colors.crosshairHorz,
        labelBackgroundColor: colors.crosshairLabel,
      },
    },
  });
  realizedSeries.applyOptions({
    color: colors.realizedLine,
  });
  zeroLine?.applyOptions({
    color: colors.zeroLine,
  });
}

function applySeriesPolarity(
  totalSeries: ISeriesApi<'Area'>,
  positive: boolean,
  colors: ChartThemeColors,
): void {
  totalSeries.applyOptions({
    lineColor: positive ? colors.up : colors.down,
    topColor: positive ? colors.upFill : colors.downFill,
    bottomColor: positive ? colors.upFillFade : colors.downFillFade,
  });
}

function toUnix(timestamp: number): UTCTimestamp {
  return Math.floor(timestamp / 1000) as UTCTimestamp;
}

function dedupeByTime(
  points: Array<{ time: UTCTimestamp; value: number }>,
): Array<{ time: UTCTimestamp; value: number }> {
  const map = new Map<number, number>();
  for (const point of points) {
    map.set(point.time, point.value);
  }
  return [...map.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([time, value]) => ({ time: time as UTCTimestamp, value }));
}

export function TrendChart({ trend, equity }: TrendChartProps) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const totalSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const realizedSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const zeroLineRef = useRef<IPriceLine | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const initialColors = getChartThemeColors();
    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: initialColors.textColor,
        fontFamily: 'IBM Plex Mono, ui-monospace, monospace',
        fontSize: 10,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: initialColors.gridColor },
        horzLines: { color: initialColors.gridColor },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.12, bottom: 0.08 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: true,
        rightOffset: 2,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: initialColors.crosshairVert,
          labelBackgroundColor: initialColors.crosshairLabel,
        },
        horzLine: {
          color: initialColors.crosshairHorz,
          labelBackgroundColor: initialColors.crosshairLabel,
        },
      },
      localization: {
        priceFormatter: (value: number) => fmtUsd(value),
        timeFormatter: (time: number) => hms(time * 1000),
      },
    });

    const totalSeries = chart.addSeries(AreaSeries, {
      lineColor: initialColors.up,
      topColor: initialColors.upFill,
      bottomColor: initialColors.upFillFade,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
      priceFormat: {
        type: 'custom',
        formatter: (value: number) => fmtUsd(value),
        minMove: 0.01,
      },
    });

    const realizedSeries = chart.addSeries(LineSeries, {
      color: initialColors.realizedLine,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      priceFormat: {
        type: 'custom',
        formatter: (value: number) => fmtUsd(value),
        minMove: 0.01,
      },
    });

    const zeroLine = totalSeries.createPriceLine({
      price: 0,
      color: initialColors.zeroLine,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
      title: '',
    });

    const markers = createSeriesMarkers(totalSeries, []);

    chartRef.current = chart;
    totalSeriesRef.current = totalSeries;
    realizedSeriesRef.current = realizedSeries;
    markersRef.current = markers;
    zeroLineRef.current = zeroLine;

    return () => {
      markers.detach();
      chart.remove();
      chartRef.current = null;
      totalSeriesRef.current = null;
      realizedSeriesRef.current = null;
      markersRef.current = null;
      zeroLineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const totalSeries = totalSeriesRef.current;
    const realizedSeries = realizedSeriesRef.current;
    const markers = markersRef.current;
    const chart = chartRef.current;
    const zeroLine = zeroLineRef.current;
    if (!totalSeries || !realizedSeries || !markers || !chart) return;

    const colors = getChartThemeColors();
    applyChartChrome(chart, realizedSeries, zeroLine, colors);

    if (!trend.length) {
      totalSeries.setData([]);
      realizedSeries.setData([]);
      markers.setMarkers([]);
      return;
    }

    const lastTotal = trend[trend.length - 1].total;
    const positive = lastTotal >= 0;
    applySeriesPolarity(totalSeries, positive, colors);

    const totalData = dedupeByTime(
      trend.map((point) => ({ time: toUnix(point.ts), value: point.total })),
    );
    const realizedData = dedupeByTime(
      trend.map((point) => ({ time: toUnix(point.ts), value: point.realized })),
    );

    totalSeries.setData(totalData);
    realizedSeries.setData(realizedData);

    const markerByTime = new Map<
      number,
      {
        time: UTCTimestamp;
        position: 'aboveBar' | 'belowBar';
        color: string;
        shape: 'circle';
        text: string;
      }
    >();

    for (const point of equity) {
      const time = toUnix(point.ts);
      const up = point.pnl >= 0;
      markerByTime.set(time, {
        time,
        position: up ? 'aboveBar' : 'belowBar',
        color: up ? colors.up : colors.down,
        shape: 'circle',
        text: `${point.symbol} ${up ? '+' : '-'}${fmtUsd(Math.abs(point.pnl))} · ${point.reason}`,
      });
    }

    markers.setMarkers(
      [...markerByTime.values()].sort((left, right) => left.time - right.time),
    );

    chart.timeScale().fitContent();
  }, [theme, trend, equity]);

  const legendItems = [
    { color: 'var(--up)', label: '总盈亏（含浮动）' },
    { color: 'var(--text-3)', label: '已实现' },
    { color: 'var(--up)', label: '盈利成交' },
    { color: 'var(--down)', label: '亏损成交' },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="absolute inset-0" />
        {!trend.length ? (
          <div className="absolute inset-0 grid place-items-center text-[11px] text-[var(--text-3)]">
            等待采样数据，盈利趋势将在此呈现
          </div>
        ) : null}
      </div>
      <div className="flex flex-none flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-[var(--line)] px-2 py-1.5">
        {legendItems.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1.5 text-[10px] text-[var(--text-2)]">
            <span className="h-1.5 w-1.5 rounded-sm" style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
