'use client';

import { useEffect, useRef, useState } from 'react';
import { SolarIcon } from '@/components/SolarIcon';
import type { DashboardState } from '@/lib/dashboard-types';
import { fmtNum, fmtPct, fmtUsd } from '@/lib/format';
import type { Locale } from '@/lib/locale';
import { useLocale } from '@/lib/use-locale';
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
  const { locale, setLocale, messages } = useLocale();
  const copy = messages.topbar;

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
    { id: 'processed', label: copy.processed, value: String(state.summary.total) },
    { id: 'buy', label: 'BUY', value: String(state.summary.BUY), tone: 'text-[var(--buy)]' },
    { id: 'observe', label: 'OBS', value: String(state.summary.OBSERVE), tone: 'text-[var(--obs)]' },
    { id: 'skip', label: 'SKIP', value: String(state.summary.SKIP), tone: 'text-[var(--skip)]' },
    {
      id: 'pnl',
      label: 'PnL',
      value: fmtUsd(state.stats.totalPnlUsd),
      tone: pnlUp ? 'text-[var(--up)]' : 'text-[var(--down)]',
      flash: pnlFlash,
    },
    { id: 'profitFactor', label: 'PF', value: fmtNum(state.stats.profitFactor) },
    { id: 'winRate', label: copy.winRate, value: fmtPct(state.stats.winRatePct) },
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
          {connected ? copy.liveFeed : copy.reconnect}
        </span>

        <div className="ml-1 hidden items-center gap-px min-[900px]:flex">
          {metrics.map((metric) => {
            const isPnl = metric.id === 'pnl';
            const flash = isPnl ? metric.flash : null;
            return (
              <div
                key={metric.id}
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
          {copy.thresholds}
        </button>
        <button
          type="button"
          onClick={onExportTrades}
          className="ui-press inline-flex items-center gap-1 rounded border border-[var(--line)] px-2 py-1 text-[10px] text-[var(--text-2)]"
        >
          {copy.exportTrades}
        </button>
        <button
          type="button"
          onClick={onExportSignals}
          className="ui-press hidden items-center gap-1 rounded border border-[var(--line)] px-2 py-1 text-[10px] text-[var(--text-2)] min-[720px]:inline-flex"
        >
          {copy.exportSignals}
        </button>
        <span className="hidden min-w-[58px] text-right font-[family-name:var(--font-mono)] text-[11px] text-[var(--text-2)] min-[520px]:inline">
          {clock}
        </span>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? copy.themeToLight : copy.themeToDark}
          title={theme === 'dark' ? copy.themeLight : copy.themeDark}
          className="ui-icon-btn inline-flex h-[26px] w-[26px] items-center justify-center rounded border border-[var(--line)] text-[var(--text-2)]"
        >
          <SolarIcon name={theme === 'dark' ? 'sun-2' : 'moon'} size={13} />
        </button>
        <div
          className="inline-flex overflow-hidden rounded border border-[var(--line)]"
          role="group"
          aria-label={copy.switchLanguage}
        >
          {(['zh', 'en'] as Locale[]).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={locale === option}
              onClick={() => setLocale(option)}
              className={`ui-press px-1.5 py-1 font-[family-name:var(--font-mono)] text-[10px] ${
                locale === option
                  ? 'bg-[var(--surface-2)] text-[var(--text)]'
                  : 'text-[var(--text-3)]'
              }`}
            >
              {option === 'zh' ? '中' : 'EN'}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
