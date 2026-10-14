import { describe, expect, it } from 'vitest';
import { StrategyEngine } from '../src/modules/strategy-engine.js';
import { fail, makeToken, makeWhale, pass } from './helpers.js';

describe('StrategyEngine', () => {
  const engine = new StrategyEngine();

  it('硬性筛选失败时返回 SKIP', () => {
    const report = engine.evaluate(makeToken(), [
      fail('security', '貔貅'),
      pass('liquidity'),
      pass('holders'),
    ]);
    expect(report.verdict).toBe('SKIP');
    expect(report.reasons.some((reason) => reason.includes('貔貅'))).toBe(true);
  });

  it('全部通过但巨鲸进场时返回 OBSERVE', () => {
    const token = makeToken({
      holders: {
        total: 500,
        top10Pct: 20,
        devPct: 3,
        largestWhalePct: 6,
        whaleCount: 1,
        whales: [makeWhale({ entering: true, pct: 6 })],
      },
    });
    const report = engine.evaluate(token, [
      pass('security'),
      pass('liquidity'),
      pass('holders'),
    ]);
    expect(report.verdict).toBe('OBSERVE');
    expect(report.reasons.some((reason) => reason.includes('巨鲸'))).toBe(true);
  });

  it('全部硬性通过且无进场巨鲸时返回 BUY', () => {
    const report = engine.evaluate(makeToken(), [
      pass('security'),
      pass('liquidity'),
      pass('holders'),
    ]);
    expect(report.verdict).toBe('BUY');
  });
});
