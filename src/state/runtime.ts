import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Position, ScreeningReport, TradeRecord, TrendPoint } from '../types.js';

// ============================================================================
// 运行时持久化 —— data/runtime.json，支持重启恢复持仓 / 成交 / 信号
// ============================================================================

export interface RuntimeSnapshot {
  version: 1;
  savedAt: string;
  openPositions: Position[];
  trades: TradeRecord[];
  trend: TrendPoint[];
  signals: ScreeningReport[];
  watchlist: ScreeningReport[];
}

const DATA_DIR = join(process.cwd(), 'data');
const RUNTIME_PATH = join(DATA_DIR, 'runtime.json');

export function ensureDataDirectory(): void {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
  } catch {
    /* 目录已存在或不可写 */
  }
}

export function loadRuntimeSnapshot(): RuntimeSnapshot | null {
  ensureDataDirectory();
  if (!existsSync(RUNTIME_PATH)) return null;
  try {
    const raw = readFileSync(RUNTIME_PATH, 'utf8');
    const parsed = JSON.parse(raw) as RuntimeSnapshot;
    if (parsed?.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveRuntimeSnapshot(snapshot: Omit<RuntimeSnapshot, 'version' | 'savedAt'>): void {
  ensureDataDirectory();
  const payload: RuntimeSnapshot = {
    version: 1,
    savedAt: new Date().toISOString(),
    ...snapshot,
  };
  try {
    writeFileSync(RUNTIME_PATH, JSON.stringify(payload, null, 2));
  } catch {
    /* 落盘失败不影响运行 */
  }
}

export function getRuntimePath(): string {
  return RUNTIME_PATH;
}
