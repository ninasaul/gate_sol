'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConfigPanel } from '@/components/dashboard/ConfigPanel';
import { LeftRail } from '@/components/dashboard/LeftRail';
import { PositionDrawer } from '@/components/dashboard/PositionDrawer';
import { StagePanel, type StageTab } from '@/components/dashboard/StagePanel';
import { StatusBar } from '@/components/dashboard/StatusBar';
import { Topbar, type PnlFlash } from '@/components/dashboard/Topbar';
import {
  emptyState,
  type DashboardPosition,
  type DashboardSignal,
  type DashboardState,
  type DexFilter,
  type VerdictFilter,
} from '@/lib/dashboard-types';
import { exportSignalsCsv, exportTradesCsv, summarizeRejectReasons } from '@/lib/export-csv';
import { hms } from '@/lib/format';
import { ThemeProvider } from '@/lib/use-theme';

export function Dashboard() {
  return (
    <ThemeProvider>
      <DashboardInner />
    </ThemeProvider>
  );
}

function DashboardInner() {
  const [state, setState] = useState<DashboardState>(emptyState);
  const [connected, setConnected] = useState(false);
  const [clock, setClock] = useState('--:--:--');
  const [pnlFlash, setPnlFlash] = useState<PnlFlash>(null);
  const [verdict, setVerdict] = useState<VerdictFilter>('ALL');
  const [dex, setDex] = useState<DexFilter>('ALL');
  const [query, setQuery] = useState('');
  const [stageTab, setStageTab] = useState<StageTab>('signals');
  const [configOpen, setConfigOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<DashboardPosition | null>(null);
  const lastPnl = useRef<number | null>(null);
  const pnlFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchState = useCallback(async () => {
    try {
      const response = await fetch('/api/state', { cache: 'no-store' });
      if (!response.ok) return;
      const next = (await response.json()) as DashboardState;
      setState(next);
      if (lastPnl.current !== null) {
        const delta = next.stats.totalPnlUsd - lastPnl.current;
        if (Math.abs(delta) >= 0.05) {
          if (pnlFlashTimer.current) clearTimeout(pnlFlashTimer.current);
          setPnlFlash(delta > 0 ? 'up' : 'down');
          pnlFlashTimer.current = setTimeout(() => setPnlFlash(null), 1000);
        }
      }
      lastPnl.current = next.stats.totalPnlUsd;
      setSelectedPosition((current) => {
        if (!current) return null;
        return (
          next.openPositions.find((position) => position.id === current.id) ??
          next.openPositions.find((position) => position.mint === current.mint) ??
          null
        );
      });
    } catch {
      /* bot 可能尚未就绪 */
    }
  }, []);

  const refreshSoon = useCallback(() => {
    if (refreshTimer.current) return;
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null;
      void fetchState();
    }, 300);
  }, [fetchState]);

  useEffect(() => {
    const tick = () => setClock(hms(Date.now()));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    void fetchState();
    const poll = setInterval(() => void fetchState(), 2500);
    const source = new EventSource('/api/events');

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);

    source.addEventListener('signal', (event) => {
      const signal = JSON.parse((event as MessageEvent).data) as DashboardSignal;
      setState((previous) => ({
        ...previous,
        recentSignals: [...previous.recentSignals, signal],
        summary: {
          ...previous.summary,
          total: previous.summary.total + 1,
          BUY: previous.summary.BUY + (signal.verdict === 'BUY' ? 1 : 0),
          OBSERVE: previous.summary.OBSERVE + (signal.verdict === 'OBSERVE' ? 1 : 0),
          SKIP: previous.summary.SKIP + (signal.verdict === 'SKIP' ? 1 : 0),
        },
      }));
    });

    source.addEventListener('observe', (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as {
        symbol: string;
        mint: string;
        reasons: string[];
      };
      setState((previous) => ({
        ...previous,
        watchlist: [...previous.watchlist, payload],
        summary: { ...previous.summary, watchlist: previous.summary.watchlist + 1 },
      }));
    });

    source.addEventListener('quote', (event) => {
      const quote = JSON.parse((event as MessageEvent).data) as {
        mint: string;
        priceUsd: number;
        marketCapUsd: number;
      };
      setState((previous) => ({
        ...previous,
        recentSignals: previous.recentSignals.map((signal) =>
          signal.mint === quote.mint
            ? {
                ...signal,
                priceUsd: quote.priceUsd,
                marketCapUsd: quote.marketCapUsd > 0 ? quote.marketCapUsd : signal.marketCapUsd,
              }
            : signal,
        ),
        openPositions: previous.openPositions.map((position) =>
          position.mint === quote.mint
            ? {
                ...position,
                currentPriceUsd: quote.priceUsd,
                marketCapUsd:
                  quote.marketCapUsd > 0 ? quote.marketCapUsd : position.marketCapUsd,
                unrealizedPct: (quote.priceUsd / position.fillPriceUsd - 1) * 100,
                unrealizedUsd:
                  (quote.priceUsd - position.fillPriceUsd) *
                  (position.sizeUsd / position.fillPriceUsd),
              }
            : position,
        ),
      }));
    });

    source.addEventListener('open', () => refreshSoon());
    source.addEventListener('close', (event) => {
      const trade = JSON.parse((event as MessageEvent).data) as {
        symbol: string;
        pnlUsd: number;
        pnlPct: number;
        reason: string;
        ts: number;
      };
      setState((previous) => {
        const lastCum = previous.equity.length ? previous.equity[previous.equity.length - 1].cum : 0;
        return {
          ...previous,
          recentTrades: [
            ...previous.recentTrades,
            {
              symbol: trade.symbol,
              pnlUsd: trade.pnlUsd,
              pnlPct: trade.pnlPct,
              reason: trade.reason,
              ts: trade.ts,
            },
          ],
          equity: [
            ...previous.equity,
            {
              ts: trade.ts,
              pnl: trade.pnlUsd,
              cum: lastCum + trade.pnlUsd,
              symbol: trade.symbol,
              reason: trade.reason,
            },
          ],
        };
      });
      refreshSoon();
    });

    return () => {
      source.close();
      clearInterval(poll);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      if (pnlFlashTimer.current) clearTimeout(pnlFlashTimer.current);
    };
  }, [fetchState, refreshSoon]);

  const filteredSignals = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...state.recentSignals]
      .reverse()
      .filter((signal) => {
        if (verdict !== 'ALL' && signal.verdict !== verdict) return false;
        if (dex !== 'ALL' && signal.dex !== dex) return false;
        if (!needle) return true;
        return (
          signal.symbol.toLowerCase().includes(needle) ||
          signal.mint.toLowerCase().includes(needle)
        );
      })
      .slice(0, 120);
  }, [state.recentSignals, verdict, dex, query]);

  const rejectStats = useMemo(
    () => summarizeRejectReasons(state.recentSignals, 8),
    [state.recentSignals],
  );

  const watchlist = [...state.watchlist].reverse();
  const trades = [...state.recentTrades].reverse().slice(0, 80);

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden">
      <div className="backdrop" aria-hidden="true" />

      <Topbar
        mode={state.mode}
        connected={connected}
        clock={clock}
        state={state}
        pnlFlash={pnlFlash}
        configOpen={configOpen}
        onToggleConfig={() => setConfigOpen((value) => !value)}
        onExportTrades={() => exportTradesCsv(state)}
        onExportSignals={() => exportSignalsCsv(state.recentSignals)}
      />

      <ConfigPanel open={configOpen} config={state.config} />

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-1.5 min-[960px]:flex-row">
        <LeftRail
          positions={state.openPositions}
          watchlist={watchlist}
          watchCount={state.summary.watchlist}
          rejectItems={rejectStats}
          config={state.config}
          onSelectPosition={setSelectedPosition}
        />

        <div className="min-h-0 min-w-0 flex-1">
          <StagePanel
            tab={stageTab}
            onTabChange={setStageTab}
            signals={filteredSignals}
            totalCount={state.summary.total}
            verdict={verdict}
            dex={dex}
            query={query}
            onVerdictChange={setVerdict}
            onDexChange={setDex}
            onQueryChange={setQuery}
            trend={state.trend}
            equity={state.equity}
            trades={trades}
          />
        </div>
      </div>

      <StatusBar state={state} connected={connected} />

      <PositionDrawer
        position={selectedPosition}
        nowMs={Date.now()}
        onClose={() => setSelectedPosition(null)}
      />
    </div>
  );
}
