import { describe, expect, it } from 'vitest';
import { PaperExecutor } from '../src/modules/executor.js';
import { makeToken } from './helpers.js';

describe('PaperExecutor', () => {
  it('价格跌破止损时平仓', async () => {
    let price = 1;
    const executor = new PaperExecutor(async () => price);
    const token = makeToken({ priceUsd: 1, symbol: 'SLTEST' });
    const position = executor.open(token);
    expect(position).not.toBeNull();

    price = 0.85; // 默认止损 -10%，含 2% 滑点后 fill≈1.02，0.85 应触发
    await executor.monitor();

    const stats = executor.getStats();
    expect(stats.totalTrades).toBe(1);
    expect(stats.losses).toBe(1);
    expect(stats.trades[0]?.closeReason).toBe('止损');
    expect(executor.getOpenPositions()).toHaveLength(0);
  });

  it('涨幅达标后回撤触发移动止盈', async () => {
    let price = 1;
    const executor = new PaperExecutor(async () => price);
    const token = makeToken({ priceUsd: 1, symbol: 'MOON' });
    executor.open(token);

    price = 1.4; // 超过 +30% 触发奔跑（fill≈1.02 → activate≈1.326）
    await executor.monitor();
    expect(executor.getOpenPositions()[0]?.mooned).toBe(true);

    price = 1.05; // 从高点回撤超过 20% 移动止损
    await executor.monitor();

    const stats = executor.getStats();
    expect(stats.totalTrades).toBe(1);
    expect(stats.trades[0]?.closeReason).toBe('移动止盈');
    expect(stats.trades[0]?.pnlUsd).toBeGreaterThan(0);
  });

  it('同一 mint 已持仓时跳过重复开仓', () => {
    const executor = new PaperExecutor(async () => 1);
    const token = makeToken({ priceUsd: 1, symbol: 'DUP', mint: 'mint-dup' });
    expect(executor.open(token)).not.toBeNull();
    expect(executor.open(token)).toBeNull();
    expect(executor.getOpenPositions()).toHaveLength(1);
  });

  it('hydrate 可恢复未平仓持仓', () => {
    const executor = new PaperExecutor(async () => 1);
    const token = makeToken({ priceUsd: 1, symbol: 'RESTORE' });
    const opened = executor.open(token);
    expect(opened).not.toBeNull();

    const payload = executor.getPersistencePayload();
    const restored = new PaperExecutor(async () => 1);
    restored.hydrate(payload);
    expect(restored.getOpenPositions()).toHaveLength(1);
    expect(restored.getOpenPositions()[0]?.symbol).toBe('RESTORE');
  });
});
