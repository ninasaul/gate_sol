'use client';

import { SolarIcon } from '@/components/SolarIcon';
import { TokenLink } from '@/components/TokenLink';
import type { DashboardPosition } from '@/lib/dashboard-types';
import { formatHeldDuration } from '@/lib/export-csv';
import { fmtPct, fmtPrice, fmtUsd } from '@/lib/format';

interface PositionDrawerProps {
  position: DashboardPosition | null;
  nowMs: number;
  onClose: () => void;
}

export function PositionDrawer({ position, nowMs, onClose }: PositionDrawerProps) {
  if (!position) return null;
  const up = position.unrealizedPct >= 0;

  const rows = [
    { label: '仓位', value: fmtUsd(position.sizeUsd) },
    { label: '成交价', value: fmtPrice(position.fillPriceUsd) },
    { label: '现价', value: fmtPrice(position.currentPriceUsd) },
    { label: '市值', value: position.marketCapUsd > 0 ? fmtUsd(position.marketCapUsd) : '--' },
    { label: '未实现盈亏', value: `${up ? '+' : ''}${fmtUsd(position.unrealizedUsd)} (${fmtPct(position.unrealizedPct)})` },
    { label: '止损价', value: fmtPrice(position.stopLossUsd) },
    { label: '奔跑触发价', value: fmtPrice(position.moonActivateUsd) },
    { label: '最高价', value: fmtPrice(position.highestPriceUsd) },
    { label: '状态', value: position.mooned ? '让利润奔跑中' : '普通持仓' },
    { label: '持仓时长', value: formatHeldDuration(position.entryTimeMs, nowMs) },
    { label: 'Mint', value: position.mint },
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
            <div className="text-[10px] text-[var(--text-3)]">持仓详情</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ui-icon-btn rounded border border-[var(--line)] p-1 text-[var(--text-2)]"
            aria-label="关闭"
          >
            <SolarIcon name="close-circle" size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-start justify-between gap-3 border-b border-[var(--line)] py-2"
            >
              <span className="flex-none text-[11px] text-[var(--text-3)]">{row.label}</span>
              {row.label === 'Mint' ? (
                <TokenLink
                  mint={position.mint}
                  className="break-all text-right font-[family-name:var(--font-mono)] text-[11px] text-[var(--accent)]"
                >
                  {row.value}
                </TokenLink>
              ) : (
                <span
                  className={`break-all text-right font-[family-name:var(--font-mono)] text-[11px] ${
                    row.label === '未实现盈亏'
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
            在 DexScreener 打开
          </TokenLink>
        </div>
      </aside>
    </div>
  );
}
