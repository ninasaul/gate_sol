'use client';

import type { DashboardConfig } from '@/lib/dashboard-types';
import { fmtUsd } from '@/lib/format';
import { useLocale } from '@/lib/use-locale';

interface ConfigPanelProps {
  open: boolean;
  config: DashboardConfig;
}

export function ConfigPanel({ open, config }: ConfigPanelProps) {
  const { messages } = useLocale();
  const copy = messages.config;
  if (!open) return null;

  const rows = [
    { id: 'minLiquidity', label: copy.minLiquidity, value: fmtUsd(config.filters.minLiquidityUsd) },
    { id: 'requireLpLocked', label: copy.requireLpLocked, value: config.filters.requireLpLocked ? copy.yes : copy.no },
    { id: 'maxDev', label: copy.maxDev, value: `${config.filters.maxDevHoldingPct}%` },
    { id: 'maxTop10', label: copy.maxTop10, value: `${config.filters.maxTop10HoldingPct}%` },
    { id: 'whale', label: copy.whale, value: `${config.filters.whaleHoldingPct}%` },
    { id: 'minHolders', label: copy.minHolders, value: String(config.filters.minHolders) },
    { id: 'positionSize', label: copy.positionSize, value: fmtUsd(config.trading.positionSizeUsd) },
    { id: 'stopLoss', label: copy.stopLoss, value: `${config.trading.stopLossPct}%` },
    { id: 'moonActivate', label: copy.moonActivate, value: `+${config.trading.moonActivatePct}%` },
    { id: 'trailingStop', label: copy.trailingStop, value: `${config.trading.trailingStopPct}%` },
    { id: 'maxPositions', label: copy.maxPositions, value: String(config.trading.maxConcurrentPositions) },
    { id: 'slippage', label: copy.slippage, value: `${config.trading.slippagePct}%` },
  ];

  return (
    <section className="flex-none border-b border-[var(--line)] bg-[var(--surface)] px-3 py-2">
      <div className="mb-1.5 text-[11px] text-[var(--text-3)]">{copy.heading}</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 min-[900px]:grid-cols-4 min-[1280px]:grid-cols-6">
        {rows.map((row) => (
          <div key={row.id} className="flex items-baseline justify-between gap-2 border-b border-[var(--line)] py-1">
            <span className="text-[10px] text-[var(--text-3)]">{row.label}</span>
            <span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--text)]">
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
