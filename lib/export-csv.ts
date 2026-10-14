import type { DashboardSignal, DashboardState } from '@/lib/dashboard-types';
import { fmtPct, fmtUsd, hms } from '@/lib/format';

function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeCell(value: string | number): string {
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function exportTradesCsv(
  state: DashboardState,
  translateReason: (reason: string) => string = (reason) => reason,
): void {
  const header = ['symbol', 'pnlUsd', 'pnlPct', 'reason', 'time'];
  const rows = state.recentTrades.map((trade) =>
    [
      trade.symbol,
      trade.pnlUsd.toFixed(2),
      trade.pnlPct.toFixed(1),
      translateReason(trade.reason),
      hms(trade.ts),
    ]
      .map(escapeCell)
      .join(','),
  );
  downloadCsv(`gatesol-trades-${Date.now()}.csv`, [header.join(','), ...rows].join('\n'));
}

export function exportSignalsCsv(
  signals: DashboardSignal[],
  translateReason: (reason: string) => string = (reason) => reason,
): void {
  const header = ['symbol', 'mint', 'dex', 'verdict', 'priceUsd', 'liquidityUsd', 'devPct', 'reasons', 'time'];
  const rows = signals.map((signal) =>
    [
      signal.symbol,
      signal.mint,
      signal.dex,
      signal.verdict,
      signal.priceUsd,
      signal.liquidityUsd,
      signal.devPct,
      (signal.reasons || []).map((reason) => translateReason(reason)).join(' | '),
      hms(signal.ts),
    ]
      .map(escapeCell)
      .join(','),
  );
  downloadCsv(`gatesol-signals-${Date.now()}.csv`, [header.join(','), ...rows].join('\n'));
}

export function summarizeRejectReasons(
  signals: DashboardSignal[],
  limit = 8,
): Array<{ reason: string; count: number }> {
  const counts = new Map<string, number>();
  for (const signal of signals) {
    if (signal.verdict !== 'SKIP') continue;
    for (const reason of signal.reasons || []) {
      const key = reason.replace(/^\[[^\]]+\]\s*/, '').trim() || reason;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, limit);
}

export function formatHeldDuration(entryTimeMs: number, nowMs: number): string {
  const seconds = Math.max(0, Math.floor((nowMs - entryTimeMs) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export { fmtPct, fmtUsd };
