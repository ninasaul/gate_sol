'use client';

import { TrendChart } from '@/components/TrendChart';
import { SignalPanel } from '@/components/dashboard/SignalPanel';
import { TradePanel } from '@/components/dashboard/TradePanel';
import { SolarIcon } from '@/components/SolarIcon';
import type {
  DashboardSignal,
  DashboardState,
  DexFilter,
  VerdictFilter,
} from '@/lib/dashboard-types';
import { useLocale } from '@/lib/use-locale';

interface StagePanelProps {
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

export function StagePanel({
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
  const { messages } = useLocale();
  const copy = messages.stage;

  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5">
      <section className="panel h-[200px] flex-none min-[1200px]:h-[228px]">
        <div className="panel-head">
          <SolarIcon name="chart-2" size={12} className="text-[var(--accent)]" />
          <h2 className="panel-title">{copy.trend}</h2>
          <span className="panel-count">{trend.length}</span>
        </div>
        <div className="min-h-0 flex-1">
          <TrendChart trend={trend} equity={equity} />
        </div>
      </section>

      {/* B：下左信号 / 右成交，同时常驻 */}
      <div className="stage-split min-h-0 flex-1">
        <section className="panel min-h-0 min-w-0">
          <div className="panel-head">
            <SolarIcon name="pulse-2" size={12} className="text-[var(--accent)]" />
            <h2 className="panel-title">{copy.signals}</h2>
            <span className="panel-count">
              {signals.length}/{totalCount}
            </span>
          </div>
          <div className="min-h-0 flex-1">
            <SignalPanel
              signals={signals}
              totalCount={totalCount}
              verdict={verdict}
              dex={dex}
              query={query}
              onVerdictChange={onVerdictChange}
              onDexChange={onDexChange}
              onQueryChange={onQueryChange}
              embedded
            />
          </div>
        </section>

        <div className="stage-trades min-h-0 min-w-0">
          <TradePanel trades={trades} />
        </div>
      </div>
    </div>
  );
}
