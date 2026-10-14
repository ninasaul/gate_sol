import { describe, expect, it } from 'vitest';
import { fmtPrice } from '../lib/format.ts';
import { price } from '../src/utils/format.ts';

describe('price formatting', () => {
  it('formats meme prices without scientific notation', () => {
    expect(fmtPrice(0.00069847)).toBe('$0.000698');
    expect(fmtPrice(3.25e-6)).toBe('$0.00000325');
    expect(fmtPrice(0.12938)).toBe('$0.1294');
    expect(fmtPrice(1.2345)).toBe('$1.2345');
  });

  it('handles invalid values', () => {
    expect(fmtPrice(0)).toBe('--');
    expect(fmtPrice(-1)).toBe('--');
  });

  it('bot logger price matches readable style', () => {
    expect(price(0.00069847)).toBe('$0.000698');
    expect(price(3.25e-6)).toBe('$0.00000325');
  });
});
