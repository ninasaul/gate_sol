'use client';

import type { DashboardState } from '@/lib/dashboard-types';
import { fmtNum, fmtPct, fmtUsd } from '@/lib/format';
import { useLocale } from '@/lib/use-locale';

interface StatusBarProps {
  state: DashboardState;
  connected: boolean;
}

export function StatusBar({ state, connected }: StatusBarProps) {
  const { messages } = useLocale();
  const copy = messages.status;
  const items = [
    state.mode === 'live' ? 'LIVE' : 'DEMO',
    connected ? copy.sseConnected : copy.sseReconnecting,
    copy.processed(state.summary.total),
    copy.open(state.openPositions.length),
    copy.win(fmtPct(state.stats.winRatePct)),
    copy.profitFactor(fmtNum(state.stats.profitFactor)),
    copy.pnl(fmtUsd(state.stats.totalPnlUsd)),
    copy.disclaimer,
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
