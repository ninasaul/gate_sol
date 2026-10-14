'use client';

import { TrendChart } from '@/components/TrendChart';
import { SignalPanel } from '@/components/dashboard/SignalPanel';
import { SolarIcon } from '@/components/SolarIcon';
import type {
  DashboardSignal,
  DashboardState,
  DexFilter,
  VerdictFilter,
} from '@/lib/dashboard-types';
import { fmtPct, fmtUsd, hms } from '@/lib/format';
import { useLocale } from '@/lib/use-locale';

export type StageTab = 'signals' | 'trades';

interface StagePanelProps {
  tab: StageTab;
  onTabChange: (tab: StageTab) => void;
  signals: DashboardSignal[];
  totalCount: number;
  verdict: VerdictFilter;
  dex: DexFilter;
  query: string;
  onVerdictChange: (value: VerdictFilter) => void;
  onDexChange: (value: DexFilter) => void;
  onQueryChange: (value: string) => void;
  trend: DashboardState['trend'];
  equity: DashboardState['equity'];
  trades: DashboardState['recentTrades'];
}

const TABS: Array<{ id: StageTab; icon: string }> = [
  { id: 'signals', icon: 'pulse-2' },
  { id: 'trades', icon: 'history' },
];

export function StagePanel({
  tab,
  onTabChange,
  signals,
  totalCount,
  verdict,
  dex,
  query,
  onVerdictChange,
  onDexChange,
  onQueryChange,
  trend,
  equity,
  trades,
}: StagePanelProps) {
  const { messages, translateReason } = useLocale();
  const copy = messages.stage;
  const tabLabel: Record<StageTab, string> = {
    signals: copy.signals,
    trades: copy.trades,
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5">
      <section className="panel h-[220px] flex-none min-[1200px]:h-[240px]">
        <div className="panel-head">
          <SolarIcon name="chart-2" size={12} className="text-[var(--accent)]" />
          <h2 className="panel-title">{copy.trend}</h2>
          <span className="panel-count">{trend.length}</span>
        </div>
        <div className="min-h-0 flex-1">
          <TrendChart trend={trend} equity={equity} />
        </div>
      </section>

      <section className="panel min-h-0 flex-1">
        <div className="panel-head !gap-1">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`ui-chip inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] ${
                tab === item.id
                  ? 'bg-[var(--surface-2)] text-[var(--text)]'
                  : 'text-[var(--text-3)]'
              }`}
            >
              <SolarIcon name={item.icon} size={12} />
              {tabLabel[item.id]}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1">
          {tab === 'signals' ? (
            <SignalPanel
              signals={signals}
              totalCount={totalCount}
              verdict={verdict}
              dex={dex}
              query={query}
              onVerdictChange={onVerdictChange}
              onDexChange={onDexChange}
              onQueryChange={onQueryChange}
            />
          ) : null}

          {tab === 'trades' ? (
            <div className="flex h-full min-h-0 flex-col">
              <div className="signal-table-head !grid-cols-[1fr_1fr_1.4fr_1fr_80px]">
                <span>{copy.symbol}</span>
                <span className="text-right">{copy.pnl}</span>
                <span>{copy.reason}</span>
                <span className="text-right">{copy.change}</span>
                <span className="text-right">{copy.time}</span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {trades.length === 0 ? (
                  <div className="empty-compact">{copy.emptyTrades}</div>
                ) : (
                  trades.map((trade, index) => {
                    const up = trade.pnlUsd >= 0;
                    return (
                      <div
                        key={`${trade.symbol}-${trade.ts}-${index}`}
                        className="signal-table-row ui-row !grid-cols-[1fr_1fr_1.4fr_1fr_80px]"
                      >
                        <span className="font-[family-name:var(--font-mono)] text-[11px] font-medium">
                          {trade.symbol}
                        </span>
                        <span
                          className={`text-right font-[family-name:var(--font-mono)] text-[11px] ${
                            up ? 'text-[var(--up)]' : 'text-[var(--down)]'
                          }`}
                        >
                          {up ? '+' : '-'}
                          {fmtUsd(Math.abs(trade.pnlUsd))}
                        </span>
                        <span className="truncate text-[10px] text-[var(--text-2)]">
                          {translateReason(trade.reason)}
                        </span>
                        <span
                          className={`text-right font-[family-name:var(--font-mono)] text-[10px] ${
                            up ? 'text-[var(--up)]' : 'text-[var(--down)]'
                          }`}
                        >
                          {fmtPct(trade.pnlPct)}
                        </span>
                        <span className="text-right font-[family-name:var(--font-mono)] text-[10px] text-[var(--text-3)]">
                          {hms(trade.ts)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
