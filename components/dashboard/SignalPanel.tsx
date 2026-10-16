'use client';

import { Empty } from '@/components/Empty';
import { TokenLink } from '@/components/TokenLink';
import type { DashboardSignal, DexFilter, VerdictFilter } from '@/lib/dashboard-types';
import { fmtPct, fmtPrice, fmtUsd, hms } from '@/lib/format';
import { useLocale } from '@/lib/use-locale';

const CHECK_KEYS = ['security', 'liquidity', 'holders'] as const;
const DEX_META: Record<string, { label: string; logo: string }> = {
  pumpfun: { label: 'pump', logo: '/assets/pumpfun.png' },
  raydium: { label: 'ray', logo: '/assets/raydium.png' },
};

interface SignalPanelProps {
  signals: DashboardSignal[];
  totalCount: number;
  verdict: VerdictFilter;
  dex: DexFilter;
  query: string;
  onVerdictChange: (value: VerdictFilter) => void;
  onDexChange: (value: DexFilter) => void;
  onQueryChange: (value: string) => void;
  /** 嵌在 Stage 面板内时隐藏重复计数 */
  embedded?: boolean;
}

export function SignalPanel({
  signals,
  totalCount,
  verdict,
  dex,
  query,
  onVerdictChange,
  onDexChange,
  onQueryChange,
  embedded = false,
}: SignalPanelProps) {
  const { messages, translateReason } = useLocale();
  const copy = messages.signal;
  const checkCopy = {
    security: { label: copy.checkSecurity, title: copy.checkSecurityTitle },
    liquidity: { label: copy.checkLiquidity, title: copy.checkLiquidityTitle },
    holders: { label: copy.checkHolders, title: copy.checkHoldersTitle },
  };
  const reasonText = (reasons: string[]) =>
    reasons.map((reason) => translateReason(reason)).join(' · ');

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-none flex-wrap items-center gap-1.5 border-b border-[var(--line)] px-2 py-1.5">
        {(['ALL', 'BUY', 'OBSERVE', 'SKIP'] as VerdictFilter[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onVerdictChange(item)}
            className={`ui-chip rounded px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[10px] ${
              verdict === item
                ? 'bg-[var(--surface-2)] text-[var(--text)] ring-1 ring-[var(--line-2)]'
                : 'text-[var(--text-3)]'
            }`}
          >
            {item === 'ALL' ? copy.all : item}
          </button>
        ))}
        <span className="mx-0.5 h-3 w-px bg-[var(--line)]" />
        {(['ALL', 'pumpfun', 'raydium'] as DexFilter[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onDexChange(item)}
            className={`ui-chip rounded px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[10px] ${
              dex === item
                ? 'bg-[var(--surface-2)] text-[var(--text)] ring-1 ring-[var(--line-2)]'
                : 'text-[var(--text-3)]'
            }`}
          >
            {item === 'ALL' ? copy.all : item}
          </button>
        ))}
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={copy.placeholder}
          className="ui-field ml-auto min-w-[120px] flex-1 rounded border border-[var(--line)] bg-[var(--bg)] px-2 py-1 font-[family-name:var(--font-mono)] text-[11px] text-[var(--text)] outline-none placeholder:text-[var(--text-3)]"
        />
        {embedded ? null : (
          <span className="font-[family-name:var(--font-mono)] text-[10px] text-[var(--text-3)]">
            {signals.length}/{totalCount}
          </span>
        )}
      </div>

      <div className="signal-table-head">
        <span>{copy.symbol}</span>
        <span>{copy.verdict}</span>
        <span>{copy.checks}</span>
        <span>{copy.reason}</span>
        <span className="text-right">{copy.price}</span>
        <span className="text-right">{copy.marketCap}</span>
        <span className="signal-col-liquidity text-right">{copy.liquidity}</span>
        <span className="signal-col-holders text-right">{copy.holders}</span>
        <span className="signal-col-dev text-right">{copy.dev}</span>
        <span className="signal-col-time text-right">{copy.time}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {signals.length === 0 ? (
          <Empty icon="pulse-2" text={copy.empty} />
        ) : (
          signals.map((signal) => {
            const dexMeta = DEX_META[signal.dex];
            const verdictColor =
              signal.verdict === 'BUY'
                ? 'text-[var(--buy)]'
                : signal.verdict === 'OBSERVE'
                  ? 'text-[var(--obs)]'
                  : 'text-[var(--skip)]';
            return (
              <div key={`${signal.mint}-${signal.ts}`} className="signal-table-row ui-row">
                <div className="min-w-0">
                  <TokenLink
                    mint={signal.mint}
                    className="truncate font-[family-name:var(--font-mono)] text-[11px] font-medium text-[var(--text)]"
                  >
                    {signal.symbol}
                  </TokenLink>
                  <div className="flex items-center gap-1 text-[9px] text-[var(--text-3)]">
                    {dexMeta ? (
                      <img src={dexMeta.logo} alt="" className="h-2.5 w-2.5 rounded-[2px] object-contain" />
                    ) : null}
                    {dexMeta?.label ?? signal.dex}
                  </div>
                </div>
                <span className={`font-[family-name:var(--font-mono)] text-[10px] font-medium ${verdictColor}`}>
                  {signal.verdict}
                </span>
                <div className="flex gap-0.5">
                  {CHECK_KEYS.map((key) => {
                    const ok = signal.checks[key];
                    return (
                      <span
                        key={key}
                        className={`rounded px-1 py-px text-[9px] ${
                          ok
                            ? 'bg-[var(--buy-soft)] text-[var(--buy)]'
                            : 'bg-[var(--skip-soft)] text-[var(--skip)]'
                        }`}
                        title={checkCopy[key].title}
                      >
                        {checkCopy[key].label}
                      </span>
                    );
                  })}
                </div>
                <div className="truncate text-[10px] text-[var(--text-2)]" title={reasonText(signal.reasons || [])}>
                  {reasonText(signal.reasons || []) || '--'}
                </div>
                <span className="text-right font-[family-name:var(--font-mono)] text-[10px] text-[var(--text-2)] tabular-nums">
                  {fmtPrice(signal.priceUsd)}
                </span>
                <span className="text-right font-[family-name:var(--font-mono)] text-[10px] text-[var(--text-2)] tabular-nums">
                  {signal.marketCapUsd > 0 ? fmtUsd(signal.marketCapUsd) : '--'}
                </span>
                <span className="signal-col-liquidity text-right font-[family-name:var(--font-mono)] text-[10px] text-[var(--text-3)] tabular-nums">
                  {fmtUsd(signal.liquidityUsd)}
                </span>
                <span className="signal-col-holders text-right font-[family-name:var(--font-mono)] text-[10px] text-[var(--text-3)] tabular-nums">
                  {typeof signal.holderCount === 'number' && signal.holderCount >= 0
                    ? signal.holderCount
                    : '--'}
                </span>
                <span className="signal-col-dev text-right font-[family-name:var(--font-mono)] text-[10px] text-[var(--text-3)]">
                  {fmtPct(signal.devPct)}
                </span>
                <span className="signal-col-time text-right font-[family-name:var(--font-mono)] text-[10px] text-[var(--text-3)]">
                  {hms(signal.ts)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
