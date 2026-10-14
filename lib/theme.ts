export type ThemeMode = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'gatesol-theme';

export function resolveTheme(stored: string | null): ThemeMode {
  if (stored === 'light' || stored === 'dark') return stored;
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

export function readStoredTheme(): string | null {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) ?? localStorage.getItem('solshot-theme');
  } catch {
    return null;
  }
}

export function writeStoredTheme(theme: ThemeMode): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore quota / private mode */
  }
}

export function readCssColor(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/** Convert #RRGGBB / #RGB to rgba() for fills */
export function colorWithAlpha(color: string, alpha: number): string {
  const trimmed = color.trim();
  if (trimmed.startsWith('#')) {
    let hex = trimmed.slice(1);
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((char) => char + char)
        .join('');
    }
    if (hex.length === 6) {
      const red = Number.parseInt(hex.slice(0, 2), 16);
      const green = Number.parseInt(hex.slice(2, 4), 16);
      const blue = Number.parseInt(hex.slice(4, 6), 16);
      return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    }
  }
  const rgbMatch = trimmed.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(',').map((part) => part.trim());
    if (parts.length >= 3) {
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
    }
  }
  return trimmed;
}

export interface ChartThemeColors {
  textColor: string;
  gridColor: string;
  crosshairLabel: string;
  crosshairVert: string;
  crosshairHorz: string;
  realizedLine: string;
  up: string;
  down: string;
  upFill: string;
  downFill: string;
  upFillFade: string;
  downFillFade: string;
  zeroLine: string;
}

export function getChartThemeColors(): ChartThemeColors {
  const up = readCssColor('--up', '#3ecf8e');
  const down = readCssColor('--down', '#e06a5e');
  const accent = readCssColor('--accent', '#5db87a');
  return {
    textColor: readCssColor('--text-3', '#5f6b7a'),
    gridColor: readCssColor('--chart-grid', 'rgba(28, 36, 48, 0.7)'),
    crosshairLabel: readCssColor('--surface-2', '#141a21'),
    crosshairVert: colorWithAlpha(accent, 0.45),
    crosshairHorz: colorWithAlpha(accent, 0.35),
    realizedLine: readCssColor('--text-3', '#8f8d86'),
    up,
    down,
    upFill: colorWithAlpha(up, 0.28),
    downFill: colorWithAlpha(down, 0.28),
    upFillFade: colorWithAlpha(up, 0),
    downFillFade: colorWithAlpha(down, 0),
    zeroLine: colorWithAlpha(accent, 0.35),
  };
}
