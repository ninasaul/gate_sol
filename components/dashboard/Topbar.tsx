'use client';

import { useEffect, useRef, useState } from 'react';
import { SolarIcon } from '@/components/SolarIcon';
import type { DashboardState } from '@/lib/dashboard-types';
import { fmtNum, fmtPct, fmtUsd } from '@/lib/format';
import { useTheme } from '@/lib/use-theme';

export type PnlFlash = 'up' | 'down' | null;

interface TopbarProps {
  mode: 'demo' | 'live';
  connected: boolean;
  clock: string;
  state: DashboardState;
  pnlFlash: PnlFlash;
  configOpen: boolean;
  onToggleConfig: () => void;
  onExportTrades: () => void;
  onExportSignals: () => void;
}

export function Topbar({
  mode,
  connected,
  clock,
  state,
  pnlFlash,
  configOpen,
  onToggleConfig,
  onExportTrades,
  onExportSignals,
}: TopbarProps) {
  const pnlUp = state.stats.totalPnlUsd >= 0;
  const [feedFlash, setFeedFlash] = useState(false);
  const wasConnected = useRef(connected);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (connected && !wasConnected.current) {
      setFeedFlash(true);
      const timer = setTimeout(() => setFeedFlash(false), 800);
      wasConnected.current = connected;
      return () => clearTimeout(timer);
    }
    wasConnected.current = connected;
  }, [connected]);

  const metrics = [
    { label: '处理', value: String(state.summary.total) },
    { label: 'BUY', value: String(state.summary.BUY), tone: 'text-[var(--buy)]' },
    { label: 'OBS', value: String(state.summary.OBSERVE), tone: 'text-[var(--obs)]' },
    { label: 'SKIP', value: String(state.summary.SKIP), tone: 'text-[var(--skip)]' },
    {
      label: 'PnL',
      value: fmtUsd(state.stats.totalPnlUsd),
      tone: pnlUp ? 'text-[var(--up)]' : 'text-[var(--down)]',
      flash: pnlFlash,
    },
    { label: 'PF', value: fmtNum(state.stats.profitFactor) },
    { label: '胜率', value: fmtPct(state.stats.winRatePct) },
  ];

  return (
    <header className="flex h-10 flex-none items-center gap-3 border-b border-[var(--line)] bg-[var(--surface)] px-3">
      <div className="flex flex-none items-center gap-2">
        <span className="text-[var(--accent)]">
          <SolarIcon name="bolt" size={16} />
        </span>
        <h1 className="font-[family-name:var(--font-ui)] text-[14px] font-semibold tracking-[0.04em]">
          Gate<span className="text-[var(--accent)]">Sol</span>
        </h1>
      </div>

      <div className="hidden h-4 w-px bg-[var(--line)] min-[720px]:block" />

      <div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto">
        <span className="inline-flex flex-none items-center gap-1.5 font-[family-name:var(--font-mono)] text-[10px] text-[var(--text-2)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          {mode === 'live' ? 'LIVE' : 'DEMO'}
        </span>
        <span
          className={`inline-flex flex-none items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] transition-colors duration-300 ${
            connected ? 'text-[var(--buy)]' : 'text-[var(--text-3)]'
          } ${feedFlash ? 'feed-connect-flash' : ''}`}
        >
          <span className="relative">
            <span
              className={`block h-1.5 w-1.5 rounded-full ${connected ? 'live-dot-pulse bg-[var(--buy)]' : 'bg-[var(--text-3)]'}`}
            />
          </span>
          {connected ? 'LIVE FEED' : 'RECONNECT'}
        </span>

        <div className="ml-1 hidden items-center gap-px min-[900px]:flex">
          {metrics.map((metric) => {
            const isPnl = metric.label === 'PnL';
            const flash = isPnl ? metric.flash : null;
            return (
              <div
                key={metric.label}
                className={`kpi-chip ui-chip flex items-baseline gap-1 rounded px-2 py-0.5 ${
                  flash === 'up'
                    ? 'kpi-flash-up'
                    : flash === 'down'
                      ? 'kpi-flash-down'
                      : ''
                }`}
              >
                <span className="text-[9px] uppercase tracking-[0.04em] text-[var(--text-3)]">
                  {metric.label}
                </span>
                <span
                  className={`font-[family-name:var(--font-mono)] text-[11px] font-medium ${
                    metric.tone ?? 'text-[var(--text)]'
                  } ${
                    flash === 'up'
                      ? 'kpi-value-tick-up kpi-hold-up'
                      : flash === 'down'
                        ? 'kpi-value-tick-down kpi-hold-down'
                        : ''
                  }`}
                >
                  {metric.value}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-none items-center gap-1.5">
        <button
          type="button"
          onClick={onToggleConfig}
          className={`ui-press inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] ${
            configOpen
              ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)] shadow-[0_0_0_1px_var(--accent-line)]'
              : 'border-[var(--line)] text-[var(--text-2)]'
          }`}
        >
          <SolarIcon name="settings" size={11} />
          阈值
        </button>
        <button
          type="button"
          onClick={onExportTrades}
          className="ui-press inline-flex items-center gap-1 rounded border border-[var(--line)] px-2 py-1 text-[10px] text-[var(--text-2)]"
        >
          导出成交
        </button>
        <button
          type="button"
          onClick={onExportSignals}
          className="ui-press hidden items-center gap-1 rounded border border-[var(--line)] px-2 py-1 text-[10px] text-[var(--text-2)] min-[720px]:inline-flex"
        >
          导出信号
        </button>
        <span className="hidden min-w-[58px] text-right font-[family-name:var(--font-mono)] text-[11px] text-[var(--text-2)] min-[520px]:inline">
          {clock}
        </span>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? '切换浅色主题' : '切换深色主题'}
          title={theme === 'dark' ? '浅色' : '深色'}
          className="ui-icon-btn inline-flex h-[26px] w-[26px] items-center justify-center rounded border border-[var(--line)] text-[var(--text-2)]"
        >
          <SolarIcon name={theme === 'dark' ? 'sun-2' : 'moon'} size={13} />
        </button>
      </div>
    </header>
  );
}
