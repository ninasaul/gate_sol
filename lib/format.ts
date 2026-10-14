export function fmtUsd(value: number): string {
  const absolute = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (absolute >= 1e6) return `${sign}$${(absolute / 1e6).toFixed(2)}M`;
  if (absolute >= 1e3) return `${sign}$${(absolute / 1e3).toFixed(1)}k`;
  return `${sign}$${absolute.toFixed(2)}`;
}

/** 代币单价：避免科学计数法，按数量级补足小数位 */
export function fmtPrice(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '--';
  if (value >= 1) return `$${value.toFixed(4)}`;
  if (value >= 1e-2) return `$${value.toFixed(4)}`;
  if (value >= 1e-4) return `$${value.toFixed(6)}`;
  if (value >= 1e-6) return `$${value.toFixed(8)}`;
  if (value >= 1e-8) return `$${value.toFixed(10)}`;
  return `$${value.toFixed(12)}`;
}

export function fmtPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '--';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export function fmtNum(value: number | null | undefined): string {
  if (value == null) return '--';
  if (value === Infinity) return 'inf';
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2);
}

export function hms(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
