// ============================================================================
// 展示格式化工具
// ============================================================================

export function pct(x: number): string {
  return `${x.toFixed(1)}%`;
}

export function usd(x: number): string {
  const abs = Math.abs(x);
  if (abs >= 1_000_000) return `$${(x / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(x / 1_000).toFixed(1)}k`;
  return `$${x.toFixed(2)}`;
}

export function signedUsd(x: number): string {
  return `${x >= 0 ? '+' : '-'}${usd(Math.abs(x))}`;
}

export function shortAddr(addr: string): string {
  if (!addr) return '-';
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function price(x: number): string {
  if (!Number.isFinite(x) || x <= 0) return '--';
  if (x >= 1) return `$${x.toFixed(4)}`;
  if (x >= 1e-2) return `$${x.toFixed(4)}`;
  if (x >= 1e-4) return `$${x.toFixed(6)}`;
  if (x >= 1e-6) return `$${x.toFixed(8)}`;
  if (x >= 1e-8) return `$${x.toFixed(10)}`;
  return `$${x.toFixed(12)}`;
}
