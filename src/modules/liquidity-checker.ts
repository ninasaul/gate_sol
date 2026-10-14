import { config } from '../config.js';
import type { FilterDecision, TokenProfile } from '../types.js';
import { usd } from '../utils/format.js';

// ============================================================================
// 模块 3/6 —— 流动性校验器
// 职责：流动性够不够、LP 锁没锁、池子年龄是否在窗口内。
//   ① 流动性不够 → 直接排除
//   ② 流动性池没锁 → 不碰
// ============================================================================

export class LiquidityChecker {
  check(t: TokenProfile): FilterDecision {
    const fails: string[] = [];
    const obs: string[] = [];
    const f = config.filters;
    const liq = t.liquidity;

    if (liq.usd < f.minLiquidityUsd) {
      fails.push(`流动性不足 ${usd(liq.usd)} < ${usd(f.minLiquidityUsd)}`);
    }
    if (f.requireLpLocked && !liq.lpLocked) {
      fails.push('流动性池未锁定 / 未燃烧');
    }
    if (liq.lpLocked && liq.lockEndTimeMs != null && liq.lockEndTimeMs > 0) {
      obs.push(`LP 锁定至 ${new Date(liq.lockEndTimeMs).toISOString().slice(0, 10)}`);
    }

    const ageMs = t.discoveredAtMs - t.createdAtMs;
    if (ageMs < f.minPoolAgeMs) obs.push('池子过新，观望');
    if (ageMs > f.maxPoolAgeMs) fails.push('池子过老，错过最佳窗口');

    const passed = fails.length === 0;
    return {
      checkId: 'liquidity',
      passed,
      reason: passed ? '流动性校验通过' : fails.join('；'),
      observations: obs,
    };
  }
}
