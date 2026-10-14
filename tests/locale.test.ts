import { describe, expect, it } from 'vitest';
import { resolveLocale } from '../lib/locale.ts';

describe('resolveLocale', () => {
  it('prefers a stored choice', () => {
    expect(resolveLocale('en', 'zh-CN')).toBe('en');
    expect(resolveLocale('zh', 'en-US')).toBe('zh');
  });

  it('follows the browser language when nothing is stored', () => {
    expect(resolveLocale(null, 'zh-CN')).toBe('zh');
    expect(resolveLocale(null, 'zh')).toBe('zh');
    expect(resolveLocale(null, 'en-US')).toBe('en');
    expect(resolveLocale(null, null)).toBe('en');
  });

  it('ignores unknown stored values', () => {
    expect(resolveLocale('fr', 'zh-Hans')).toBe('zh');
    expect(resolveLocale('fr', 'ja')).toBe('en');
  });
});
