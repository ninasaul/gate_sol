import type { Dex } from '../types.js';

/** 链上程序与日志关键字 —— 用于发现新币 / 新池 */

export const WSOL_MINT = 'So11111111111111111111111111111111111111112';

export const QUOTE_MINTS = new Set<string>([
  WSOL_MINT,
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
  'USD1ttGY1N17NEEOGmADkUENaL5VyREbY1X8d4jJ3n', // USD1 (偶见)
]);

export type ChainProgramKind = 'pump' | 'raydium_amm' | 'raydium_cpmm';

export interface ChainProgramSpec {
  kind: ChainProgramKind;
  dex: Dex;
  programId: string;
  /** 日志命中任一即视为候选创建事件 */
  logPatterns: RegExp[];
}

export const CHAIN_PROGRAMS: ChainProgramSpec[] = [
  {
    kind: 'pump',
    dex: 'pumpfun',
    programId: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
    // 链上实测多为「Program log: Create」，少数带 Instruction: 前缀
    logPatterns: [/Program log: Create\b/i, /Instruction:\s*Create\b/i],
  },
  {
    kind: 'raydium_amm',
    dex: 'raydium',
    programId: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
    logPatterns: [/initialize2/i],
  },
  {
    kind: 'raydium_cpmm',
    dex: 'raydium',
    programId: 'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C',
    logPatterns: [/Instruction:\s*CreatePool\b/i, /createPool/i],
  },
];

export function matchProgramLogs(
  logs: string[] | null | undefined,
  patterns: RegExp[],
): boolean {
  if (!logs?.length) return false;
  return logs.some((line) => patterns.some((pattern) => pattern.test(line)));
}

export function isTradableMint(mint: string): boolean {
  return Boolean(mint) && !QUOTE_MINTS.has(mint);
}
