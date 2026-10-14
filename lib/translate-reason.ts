import type { Locale } from '@/lib/locale';

const CHECK_PREFIX: Record<string, string> = {
  安全: 'Security',
  流动性: 'Liquidity',
  持仓: 'Holders',
};

const EXACT_CLAUSE: Record<string, string> = {
  '疑似貔貅盘（买入后无法卖出）': 'Suspected honeypot (cannot sell after buy)',
  'mint 权限未放弃，可无限增发': 'Mint authority not renounced; supply can be inflated',
  'freeze 权限未放弃，可冻结持仓': 'Freeze authority not renounced; balances can be frozen',
  '安全审计通过': 'Security audit passed',
  '流动性池未锁定 / 未燃烧': 'Liquidity pool unlocked or not burned',
  '池子过老，错过最佳窗口': 'Pool too old; missed the entry window',
  '流动性校验通过': 'Liquidity check passed',
  '持仓分布合理': 'Holder distribution looks healthy',
  '检测到巨鲸进场，仅观察不买入': 'Whale entry detected; observe only, no buy',
  '全部硬性筛选通过': 'All hard filters passed',
  '止损': 'Stop loss',
  '移动止盈': 'Trailing take-profit',
  'metadata 可修改（可改名/换图）': 'Metadata is mutable (name or image can change)',
  '未通过 RugCheck 验证': 'Not verified by RugCheck',
  '池子过新，观望': 'Pool too new; waiting',
  '持有人总数未知': 'Holder count unknown',
};

const CLAUSE_PATTERNS: Array<{ pattern: RegExp; format: (matches: RegExpMatchArray) => string }> = [
  {
    pattern: /^流动性不足 (.+) < (.+)$/,
    format: (matches) => `Liquidity ${matches[1]} is below ${matches[2]}`,
  },
  {
    pattern: /^项目方持仓 (.+) > (.+)$/,
    format: (matches) => `Dev holding ${matches[1]} > ${matches[2]}`,
  },
  {
    pattern: /^前10持仓集中 (.+) > (.+)$/,
    format: (matches) => `Top-10 concentration ${matches[1]} > ${matches[2]}`,
  },
  {
    pattern: /^LP 锁定至 (\d{4}-\d{2}-\d{2})$/,
    format: (matches) => `LP locked until ${matches[1]}`,
  },
  {
    pattern: /^持有人过少（(.+) < (.+)）$/,
    format: (matches) => `Too few holders (${matches[1]} < ${matches[2]})`,
  },
  {
    pattern: /^巨鲸进场 (\S+) 持仓 (.+)，买入 (.+) → 仅观察$/,
    format: (matches) =>
      `Whale entering ${matches[1]} holding ${matches[2]}, bought ${matches[3]}; observe only`,
  },
  {
    pattern: /^巨鲸持仓 (\S+) (\S+)$/,
    format: (matches) => `Whale holding ${matches[1]} ${matches[2]}`,
  },
];

function translateClause(clause: string): string {
  const exact = EXACT_CLAUSE[clause];
  if (exact) return exact;
  for (const entry of CLAUSE_PATTERNS) {
    const matches = clause.match(entry.pattern);
    if (matches) return entry.format(matches);
  }
  return clause;
}

export function translateReason(reason: string, locale: Locale): string {
  if (locale === 'zh' || reason.length === 0) return reason;

  const prefixMatch = /^\[([^\]]+)\]\s*/.exec(reason);
  const body = prefixMatch ? reason.slice(prefixMatch[0].length) : reason;
  const clauses = body
    .split('；')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (clauses.length === 0) return reason;

  const translatedClauses = clauses.map((clause) => translateClause(clause));
  const prefixLabel = prefixMatch ? CHECK_PREFIX[prefixMatch[1]] : undefined;
  const changed =
    Boolean(prefixLabel) || translatedClauses.some((clause, index) => clause !== clauses[index]);
  if (!changed) return reason;

  const translated = translatedClauses.join('; ');
  if (!prefixMatch) return translated;
  return `[${prefixLabel ?? prefixMatch[1]}] ${translated}`;
}
