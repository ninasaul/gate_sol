'use client';

import { Empty } from '@/components/Empty';
import { SolarIcon } from '@/components/SolarIcon';
import type { DashboardState } from '@/lib/dashboard-types';
import { fmtPct, fmtUsd, hms } from '@/lib/format';
import { useLocale } from '@/lib/use-locale';

interface TradePanelProps {
  trades: DashboardState['recentTrades'];
}

export function TradePanel({ trades }: TradePanelProps) {
  const { messages, translateReason } = useLocale();
  const copy = messages.stage;

  return (
    <section className="panel flex h-full min-h-0 min-w-0 flex-col">
      <div className="panel-head">
        <SolarIcon name="history" size={12} className="text-[var(--accent)]" />
        <h2 className="panel-title">{copy.trades}</h2>
        <span className="panel-count">{trades.length}</span>
      </div>

      <div className="trade-table-head">
        <span>{copy.symbol}</span>
        <span className="text-right">{copy.pnl}</span>
        <span className="trade-col-reason">{copy.reason}</span>
        <span className="text-right">{copy.change}</span>
        <span className="text-right">{copy.time}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {trades.length === 0 ? (
          <Empty icon="history" text={copy.emptyTrades} />
        ) : (
          trades.map((trade, index) => {
            const up = trade.pnlUsd >= 0;
            return (
              <div
                key={`${trade.symbol}-${trade.ts}-${index}`}
                className="trade-table-row ui-row"
              >
                <span className="truncate font-[family-name:var(--font-mono)] text-[11px] font-medium text-[var(--text)]">
                  {trade.symbol}
                </span>
                <span
                  className={`text-right font-[family-name:var(--font-mono)] text-[11px] tabular-nums ${
                    up ? 'text-[var(--up)]' : 'text-[var(--down)]'
                  }`}
                >
                  {up ? '+' : '-'}
                  {fmtUsd(Math.abs(trade.pnlUsd))}
                </span>
                <span
                  className="trade-col-reason truncate text-[10px] text-[var(--text-2)]"
                  title={translateReason(trade.reason)}
                >
                  {translateReason(trade.reason)}
                </span>
                <span
                  className={`text-right font-[family-name:var(--font-mono)] text-[10px] tabular-nums ${
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
    </section>
  );
}
