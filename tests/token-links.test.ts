import { describe, expect, it } from 'vitest';
import { dexScreenerUrl } from '../lib/token-links.ts';

describe('dexScreenerUrl', () => {
  it('builds solana token page url', () => {
    expect(dexScreenerUrl('So11111111111111111111111111111111111111112')).toBe(
      'https://dexscreener.com/solana/So11111111111111111111111111111111111111112',
    );
  });

  it('trims and encodes mint', () => {
    expect(dexScreenerUrl(' abc/def ')).toBe('https://dexscreener.com/solana/abc%2Fdef');
  });
});
