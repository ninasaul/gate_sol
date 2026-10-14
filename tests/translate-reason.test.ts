import { describe, expect, it } from 'vitest';
import { translateReason } from '../lib/translate-reason.ts';

describe('translateReason', () => {
  it('keeps the original text in Chinese', () => {
    expect(translateReason('止损', 'zh')).toBe('止损');
    expect(translateReason('[安全] 疑似貔貅盘（买入后无法卖出）', 'zh')).toBe(
      '[安全] 疑似貔貅盘（买入后无法卖出）',
    );
  });

  it('translates exact clauses and close reasons', () => {
    expect(translateReason('止损', 'en')).toBe('Stop loss');
    expect(translateReason('移动止盈', 'en')).toBe('Trailing take-profit');
    expect(translateReason('全部硬性筛选通过', 'en')).toBe('All hard filters passed');
    expect(translateReason('检测到巨鲸进场，仅观察不买入', 'en')).toBe(
      'Whale entry detected; observe only, no buy',
    );
  });

  it('translates prefixed clauses and keeps numeric fragments', () => {
    expect(
      translateReason('[流动性] 流动性不足 $1.2k < $50.0k；流动性池未锁定 / 未燃烧', 'en'),
    ).toBe('[Liquidity] Liquidity $1.2k is below $50.0k; Liquidity pool unlocked or not burned');
    expect(translateReason('[持仓] 项目方持仓 12.0% > 7.0%', 'en')).toBe(
      '[Holders] Dev holding 12.0% > 7.0%',
    );
    expect(translateReason('前10持仓集中 40.0% > 35.0%', 'en')).toBe(
      'Top-10 concentration 40.0% > 35.0%',
    );
    expect(
      translateReason('巨鲸进场 Abcd…wxyz 持仓 6.0%，买入 $12.0k → 仅观察', 'en'),
    ).toBe('Whale entering Abcd…wxyz holding 6.0%, bought $12.0k; observe only');
  });

  it('leaves unknown sentences unchanged', () => {
    expect(translateReason('自定义原因', 'en')).toBe('自定义原因');
    expect(translateReason('[其他] 看不懂的句子', 'en')).toBe('[其他] 看不懂的句子');
  });
});
