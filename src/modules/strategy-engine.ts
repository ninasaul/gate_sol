import { config } from '../config.js';
import type { FilterDecision, FinalVerdict, ScreeningReport, TokenProfile } from '../types.js';

// ============================================================================
// 模块 5/6 —— 策略引擎
// 职责：汇总前三道硬性筛选的结论，给出最终决策：
//   任一硬性条件不过 → SKIP（跳过）
//   巨鲸进场           → OBSERVE（只观察，绝不买入）
//   全部通过           → BUY（纸面开仓）
// ============================================================================

const LABEL: Record<string, string> = {
  security: '安全',
  liquidity: '流动性',
  holders: '持仓',
};

export class StrategyEngine {
  evaluate(token: TokenProfile, decisions: FilterDecision[]): ScreeningReport {
    const reasons: string[] = [];
    for (const d of decisions) {
      if (!d.passed) reasons.push(`[${LABEL[d.checkId] ?? d.checkId}] ${d.reason}`);
    }

    const hardFail = decisions.some((d) => !d.passed);
    const whaleEntering = token.holders.whales.some(
      (w) => w.entering && w.pct >= config.filters.whaleHoldingPct,
    );

    let verdict: FinalVerdict;
    if (hardFail) {
      verdict = 'SKIP';
    } else if (whaleEntering) {
      verdict = 'OBSERVE';
      reasons.push('检测到巨鲸进场，仅观察不买入');
    } else {
      verdict = 'BUY';
      reasons.push('全部硬性筛选通过');
    }

    return { token, decisions, verdict, reasons };
  }
}
