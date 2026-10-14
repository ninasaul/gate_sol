'use client';

import type { DashboardConfig } from '@/lib/dashboard-types';
import { fmtUsd } from '@/lib/format';

interface ConfigPanelProps {
  open: boolean;
  config: DashboardConfig;
}

export function ConfigPanel({ open, config }: ConfigPanelProps) {
  if (!open) return null;

  const rows = [
    { label: '最低流动性', value: fmtUsd(config.filters.minLiquidityUsd) },
    { label: '要求 LP 锁定', value: config.filters.requireLpLocked ? '是' : '否' },
    { label: '项目方持仓上限', value: `${config.filters.maxDevHoldingPct}%` },
    { label: '前10持仓上限', value: `${config.filters.maxTop10HoldingPct}%` },
    { label: '鲸鱼阈值', value: `${config.filters.whaleHoldingPct}%` },
    { label: '最低持有人', value: String(config.filters.minHolders) },
    { label: '单笔仓位', value: fmtUsd(config.trading.positionSizeUsd) },
    { label: '止损', value: `${config.trading.stopLossPct}%` },
    { label: '奔跑触发', value: `+${config.trading.moonActivatePct}%` },
    { label: '移动止损', value: `${config.trading.trailingStopPct}%` },
    { label: '最大持仓数', value: String(config.trading.maxConcurrentPositions) },
    { label: '滑点', value: `${config.trading.slippagePct}%` },
  ];

  return (
    <section className="flex-none border-b border-[var(--line)] bg-[var(--surface)] px-3 py-2">
      <div className="mb-1.5 text-[11px] text-[var(--text-3)]">当前阈值（只读，来自 Bot 配置）</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 min-[900px]:grid-cols-4 min-[1280px]:grid-cols-6">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-2 border-b border-[var(--line)] py-1">
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
