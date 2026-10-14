import type { FilterDecision, TokenProfile } from '../types.js';

// ============================================================================
// 模块 2/6 —— 安全审计器
// 职责：合约层面排雷 —— 貔貅盘、增发/冻结权限、metadata 可篡改等。
// ============================================================================

export class SecurityAuditor {
  check(t: TokenProfile): FilterDecision {
    const fails: string[] = [];
    const obs: string[] = [];
    const s = t.security;

    if (s.isHoneypot) fails.push('疑似貔貅盘（买入后无法卖出）');
    if (!s.mintAuthorityRenounced) fails.push('mint 权限未放弃，可无限增发');
    if (!s.freezeAuthorityRenounced) fails.push('freeze 权限未放弃，可冻结持仓');
    if (s.metadataMutable) obs.push('metadata 可修改（可改名/换图）');
    if (!s.verified) obs.push('未通过 RugCheck 验证');

    const passed = fails.length === 0;
    return {
      checkId: 'security',
      passed,
      reason: passed ? '安全审计通过' : fails.join('；'),
      observations: obs,
    };
  }
}
