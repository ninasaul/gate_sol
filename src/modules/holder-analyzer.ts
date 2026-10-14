import { config } from '../config.js';
import type { FilterDecision, TokenProfile } from '../types.js';
import { pct, shortAddr, usd } from '../utils/format.js';

// ============================================================================
// 模块 4/6 —— 持仓分析器
// 职责：判断筹码分布是否健康。
//   ③ 项目方持仓超过 ~7% → 直接跳过
//   ④ 巨鲸进场 → 只加观察，不直接买入
// ============================================================================

export class HolderAnalyzer {
  check(t: TokenProfile): FilterDecision {
    const fails: string[] = [];
    const obs: string[] = [];
    const f = config.filters;
    const h = t.holders;

    if (h.devPct > f.maxDevHoldingPct) {
      fails.push(`项目方持仓 ${pct(h.devPct)} > ${pct(f.maxDevHoldingPct)}`);
    }
    if (h.top10Pct > f.maxTop10HoldingPct) {
      fails.push(`前10持仓集中 ${pct(h.top10Pct)} > ${pct(f.maxTop10HoldingPct)}`);
    }
    if (h.total >= 0 && h.total < f.minHolders) {
      obs.push(`持有人过少（${h.total} < ${f.minHolders}）`);
    } else if (h.total < 0) {
      obs.push('持有人总数未知');
    }

    // 鲸鱼检测：达标即观察，进场鲸鱼绝不直接买入
    for (const w of h.whales) {
      if (w.pct < f.whaleHoldingPct) continue;
      if (w.entering) {
        obs.push(`巨鲸进场 ${shortAddr(w.address)} 持仓 ${pct(w.pct)}，买入 ${usd(w.buyVolumeUsd)} → 仅观察`);
      } else {
        obs.push(`巨鲸持仓 ${shortAddr(w.address)} ${pct(w.pct)}`);
      }
    }

    const passed = fails.length === 0;
    return {
      checkId: 'holders',
      passed,
      reason: passed ? '持仓分布合理' : fails.join('；'),
      observations: obs,
    };
  }
}
