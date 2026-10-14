import { describe, expect, it } from 'vitest';
import { matchProgramLogs } from '../src/services/chain-programs.js';
import { pickMintFromParsedTransaction } from '../src/services/chain-scanner.js';

const WSOL = 'So11111111111111111111111111111111111111112';
const MEME = 'AbCdEfGhIjKlMnOpQrStUvWxYz123456789pump';

describe('matchProgramLogs', () => {
  it('matches raydium initialize2', () => {
    expect(matchProgramLogs(['Program log: initialize2: InitializeInstruction2'], [/initialize2/i])).toBe(
      true,
    );
  });

  it('matches pump Create without Instruction prefix', () => {
    expect(
      matchProgramLogs(['Program log: Create'], [/Program log: Create\b/i, /Instruction:\s*Create\b/i]),
    ).toBe(true);
  });

  it('rejects pump buy/sell noise', () => {
    expect(
      matchProgramLogs(['Program log: Instruction: Buy'], [/Program log: Create\b/i, /Instruction:\s*Create\b/i]),
    ).toBe(false);
  });

  it('rejects unrelated logs', () => {
    expect(matchProgramLogs(['Program log: Instruction: Swap'], [/initialize2/i])).toBe(false);
  });
});

describe('pickMintFromParsedTransaction', () => {
  it('prefers novel post-balance mint over WSOL', () => {
    const mint = pickMintFromParsedTransaction({
      meta: {
        preTokenBalances: [{ mint: WSOL }],
        postTokenBalances: [{ mint: WSOL }, { mint: MEME }],
      },
    });
    expect(mint).toBe(MEME);
  });

  it('prefers pump-suffix when multiple novel mints', () => {
    const other = '11111111111111111111111111111111';
    const mint = pickMintFromParsedTransaction({
      meta: {
        preTokenBalances: [],
        postTokenBalances: [{ mint: other }, { mint: MEME }],
      },
    });
    expect(mint).toBe(MEME);
  });

  it('returns null when only quote mints', () => {
    const mint = pickMintFromParsedTransaction({
      meta: {
        preTokenBalances: [],
        postTokenBalances: [{ mint: WSOL }],
      },
    });
    expect(mint).toBeNull();
  });
});
