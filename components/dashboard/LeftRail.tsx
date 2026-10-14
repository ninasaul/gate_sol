'use client';

import { SolarIcon } from '@/components/SolarIcon';
import { TokenLink } from '@/components/TokenLink';
import type { DashboardConfig, DashboardPosition, DashboardState } from '@/lib/dashboard-types';
import { fmtPct, fmtPrice, fmtUsd } from '@/lib/format';

interface LeftRailProps {
  positions: DashboardPosition[];
  watchlist: DashboardState['watchlist'];
  watchCount: number;
  rejectItems: Array<{ reason: string; count: number }>;
  config: DashboardConfig;
  onSelectPosition: (position: DashboardPosition) => void;
}

export function LeftRail({
  positions,
  watchlist,
  watchCount,
  rejectItems,
  config,
  onSelectPosition,
}: LeftRailProps) {
  const rejectMax = Math.max(1, ...rejectItems.map((item) => item.count));
  const configRows = [
    { label: '流动性', value: fmtUsd(config.filters.minLiquidityUsd) },
    { label: 'Dev上限', value: `${config.filters.maxDevHoldingPct}%` },
    { label: '止损', value: `${config.trading.stopLossPct}%` },
    { label: '奔跑', value: `+${config.trading.moonActivatePct}%` },
  ];

  return (
    <aside className="flex h-full min-h-0 w-full flex-col gap-1.5 min-[960px]:w-[var(--rail)] min-[960px]:flex-none">
      <section className="panel min-h-0 flex-[1.2]">
        <div className="panel-head">
          <SolarIcon name="box" size={12} className="text-[var(--accent)]" />
          <h2 className="panel-title">持仓</h2>
          <span className="panel-count">{positions.length}</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {positions.length === 0 ? (
            <div className="empty-compact">暂无持仓</div>
          ) : (
            positions.map((position) => {
              const up = position.unrealizedPct >= 0;
              return (
                <div
                  key={position.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectPosition(position)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelectPosition(position);
                    }
                  }}
                  className="row-compact ui-row w-full text-left"
                >
                  <span
                    className={`grid h-5 w-5 flex-none place-items-center rounded border ${
                      position.mooned
                        ? 'border-[var(--accent-line)] text-[var(--accent)]'
                        : 'border-[var(--line)] text-[var(--text-3)]'
                    }`}
                  >
                    <SolarIcon name={position.mooned ? 'moon' : 'wallet'} size={11} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <TokenLink
                      mint={position.mint}
                      stopPropagation
                      className="font-[family-name:var(--font-mono)] text-[11px] font-medium text-[var(--text)]"
                    >
                      {position.symbol}
                    </TokenLink>
                    <div className="truncate text-[9px] text-[var(--text-3)]">
                      {fmtPrice(position.currentPriceUsd)}
                      {position.marketCapUsd > 0 ? ` · ${fmtUsd(position.marketCapUsd)}` : ''}
                    </div>
                  </div>
                  <div className="flex-none text-right">
                    <div
                      className={`font-[family-name:var(--font-mono)] text-[11px] ${
                        up ? 'text-[var(--up)]' : 'text-[var(--down)]'
                      }`}
                    >
                      {fmtPct(position.unrealizedPct)}
                    </div>
                    <div className="text-[9px] text-[var(--text-3)]">
                      {position.mooned ? '奔跑' : fmtUsd(position.sizeUsd)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="panel min-h-0 flex-1">
        <div className="panel-head">
          <SolarIcon name="eye" size={12} className="text-[var(--accent)]" />
          <h2 className="panel-title">观察</h2>
          <span className="panel-count">{watchCount}</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {watchlist.length === 0 ? (
            <div className="empty-compact">暂无观察</div>
          ) : (
            watchlist.slice(0, 40).map((item, index) => (
              <div key={`${item.mint}-${item.symbol}-${index}`} className="row-compact ui-row">
                <div className="min-w-0 flex-1">
                  <TokenLink
                    mint={item.mint}
                    className="font-[family-name:var(--font-mono)] text-[11px] font-medium text-[var(--text)]"
                  >
                    {item.symbol}
                  </TokenLink>
                  <div className="truncate text-[9px] text-[var(--text-3)]">
                    {(item.reasons || []).join(' · ') || '--'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="panel flex-none">
        <div className="panel-head">
          <SolarIcon name="forbidden" size={12} className="text-[var(--accent)]" />
          <h2 className="panel-title">拒绝 Top</h2>
        </div>
        <div className="max-h-[120px] space-y-1.5 overflow-y-auto px-2 py-1.5">
          {rejectItems.length === 0 ? (
            <div className="empty-compact !py-2">暂无</div>
          ) : (
            rejectItems.slice(0, 5).map((item) => (
              <div key={item.reason}>
                <div className="mb-0.5 flex justify-between gap-2">
                  <span className="truncate text-[10px] text-[var(--text-2)]" title={item.reason}>
                    {item.reason}
                  </span>
                  <span className="font-[family-name:var(--font-mono)] text-[9px] text-[var(--text-3)]">
                    {item.count}
                  </span>
                </div>
                <div className="h-0.5 overflow-hidden rounded bg-[var(--bg)]">
                  <div
                    className="h-full bg-[var(--skip)]"
                    style={{ width: `${(item.count / rejectMax) * 100}%`, opacity: 0.7 }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="panel flex-none">
        <div className="panel-head">
          <SolarIcon name="settings" size={12} className="text-[var(--accent)]" />
          <h2 className="panel-title">阈值</h2>
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 px-2 py-1.5">
          {configRows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-1">
              <span className="text-[9px] text-[var(--text-3)]">{row.label}</span>
              <span className="font-[family-name:var(--font-mono)] text-[10px]">{row.value}</span>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}
