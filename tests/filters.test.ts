import { describe, expect, it } from 'vitest';
import { SecurityAuditor } from '../src/modules/security-auditor.js';
import { LiquidityChecker } from '../src/modules/liquidity-checker.js';
import { HolderAnalyzer } from '../src/modules/holder-analyzer.js';
import { makeHolders, makeLiquidity, makeSecurity, makeToken } from './helpers.js';

describe('SecurityAuditor', () => {
  const auditor = new SecurityAuditor();

  it('通过安全审计', () => {
    expect(auditor.check(makeToken()).passed).toBe(true);
  });

  it('貔貅盘失败', () => {
    const result = auditor.check(makeToken({ security: makeSecurity({ isHoneypot: true }) }));
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('貔貅');
  });

  it('mint 权限未放弃失败', () => {
    const result = auditor.check(
      makeToken({ security: makeSecurity({ mintAuthorityRenounced: false }) }),
    );
    expect(result.passed).toBe(false);
  });
});

describe('LiquidityChecker', () => {
  const checker = new LiquidityChecker();

  it('流动性充足且 LP 锁定通过', () => {
    expect(checker.check(makeToken()).passed).toBe(true);
  });

  it('流动性不足失败', () => {
    const result = checker.check(
      makeToken({ liquidity: makeLiquidity({ usd: 10_000 }) }),
    );
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('流动性不足');
  });

  it('LP 未锁定失败', () => {
    const result = checker.check(
      makeToken({ liquidity: makeLiquidity({ lpLocked: false }) }),
    );
    expect(result.passed).toBe(false);
  });
});

describe('HolderAnalyzer', () => {
  const analyzer = new HolderAnalyzer();

  it('持仓分布合理通过', () => {
    expect(analyzer.check(makeToken()).passed).toBe(true);
  });

  it('项目方持仓过高失败', () => {
    const result = analyzer.check(
      makeToken({ holders: makeHolders({ devPct: 12 }) }),
    );
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('项目方');
  });

  it('前10集中度过高失败', () => {
    const result = analyzer.check(
      makeToken({ holders: makeHolders({ top10Pct: 50 }) }),
    );
    expect(result.passed).toBe(false);
  });
});
