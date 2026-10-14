'use client';

import { SolarIcon } from '@/components/SolarIcon';
import { TokenLink } from '@/components/TokenLink';
import type { DashboardPosition } from '@/lib/dashboard-types';
import { formatHeldDuration } from '@/lib/export-csv';
import { fmtPct, fmtPrice, fmtUsd } from '@/lib/format';
import { useLocale } from '@/lib/use-locale';

interface PositionDrawerProps {
  position: DashboardPosition | null;
  nowMs: number;
  onClose: () => void;
}

export function PositionDrawer({ position, nowMs, onClose }: PositionDrawerProps) {
  const { messages } = useLocale();
  const copy = messages.drawer;
  if (!position) return null;
  const up = position.unrealizedPct >= 0;

  const rows = [
    { id: 'size', label: copy.size, value: fmtUsd(position.sizeUsd) },
    { id: 'fill', label: copy.fill, value: fmtPrice(position.fillPriceUsd) },
    { id: 'mark', label: copy.mark, value: fmtPrice(position.currentPriceUsd) },
    { id: 'marketCap', label: copy.marketCap, value: position.marketCapUsd > 0 ? fmtUsd(position.marketCapUsd) : '--' },
    {
      id: 'unrealized',
      label: copy.unrealized,
      value: `${up ? '+' : ''}${fmtUsd(position.unrealizedUsd)} (${fmtPct(position.unrealizedPct)})`,
    },
    { id: 'stop', label: copy.stop, value: fmtPrice(position.stopLossUsd) },
    { id: 'moon', label: copy.moon, value: fmtPrice(position.moonActivateUsd) },
    { id: 'high', label: copy.high, value: fmtPrice(position.highestPriceUsd) },
    { id: 'status', label: copy.status, value: position.mooned ? copy.running : copy.standard },
    { id: 'held', label: copy.held, value: formatHeldDuration(position.entryTimeMs, nowMs) },
    { id: 'mint', label: copy.mint, value: position.mint },
  ];

  return (
    <div className="ui-backdrop fixed inset-0 z-[80] flex justify-end bg-black/45" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-[360px] flex-col border-l border-[var(--line)] bg-[var(--surface)] shadow-[var(--drawer-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[var(--line)] px-3 py-2.5">
          <span className="text-[var(--accent)]">
            <SolarIcon name="box" size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <TokenLink
              mint={position.mint}
              className="font-[family-name:var(--font-mono)] text-[14px] font-medium text-[var(--text)]"
            >
              {position.symbol}
            </TokenLink>
            <div className="text-[10px] text-[var(--text-3)]">{copy.title}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ui-icon-btn rounded border border-[var(--line)] p-1 text-[var(--text-2)]"
            aria-label={copy.close}
          >
            <SolarIcon name="close-circle" size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex items-start justify-between gap-3 border-b border-[var(--line)] py-2"
            >
              <span className="flex-none text-[11px] text-[var(--text-3)]">{row.label}</span>
              {row.id === 'mint' ? (
                <TokenLink
                  mint={position.mint}
                  className="break-all text-right font-[family-name:var(--font-mono)] text-[11px] text-[var(--accent)]"
                >
                  {row.value}
                </TokenLink>
              ) : (
                <span
                  className={`break-all text-right font-[family-name:var(--font-mono)] text-[11px] ${
                    row.id === 'unrealized'
                      ? up
                        ? 'text-[var(--up)]'
                        : 'text-[var(--down)]'
                      : 'text-[var(--text)]'
                  }`}
                >
                  {row.value}
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="border-t border-[var(--line)] p-3">
          <TokenLink
            mint={position.mint}
            className="ui-cta flex w-full items-center justify-center rounded border border-[var(--accent-line)] bg-[var(--accent-soft)] px-3 py-2 text-[12px] text-[var(--accent)]"
          >
            {copy.openDex}
          </TokenLink>
        </div>
      </aside>
    </div>
  );
}
