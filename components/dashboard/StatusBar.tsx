'use client';

import type { DashboardState } from '@/lib/dashboard-types';
import { fmtNum, fmtPct, fmtUsd } from '@/lib/format';

interface StatusBarProps {
  state: DashboardState;
  connected: boolean;
}

export function StatusBar({ state, connected }: StatusBarProps) {
  const items = [
    state.mode === 'live' ? 'LIVE' : 'DEMO',
    connected ? 'SSE connected' : 'SSE reconnecting',
    `processed ${state.summary.total}`,
    `open ${state.openPositions.length}`,
    `win ${fmtPct(state.stats.winRatePct)}`,
    `pf ${fmtNum(state.stats.profitFactor)}`,
    `pnl ${fmtUsd(state.stats.totalPnlUsd)}`,
    'signal for reference only',
  ];

  return (
    <footer className="flex h-7 flex-none items-center gap-2 overflow-x-auto border-t border-[var(--line)] bg-[var(--surface)] px-3 font-[family-name:var(--font-mono)] text-[10px] text-[var(--text-3)]">
      {items.map((item, index) => (
        <span key={`${item}-${index}`} className="inline-flex items-center gap-2 whitespace-nowrap">
          {index > 0 ? <span className="text-[var(--line-2)]">|</span> : null}
          <span>{item}</span>
        </span>
      ))}
    </footer>
  );
}
