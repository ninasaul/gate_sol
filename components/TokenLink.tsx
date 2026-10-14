'use client';

import type { MouseEvent, ReactNode } from 'react';
import { dexScreenerUrl } from '@/lib/token-links';

interface TokenLinkProps {
  mint: string;
  children: ReactNode;
  className?: string;
  title?: string;
  stopPropagation?: boolean;
}

export function TokenLink({
  mint,
  children,
  className,
  title = '在 DexScreener 打开',
  stopPropagation = false,
}: TokenLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (stopPropagation) event.stopPropagation();
  };

  const classes = ['ui-link', className].filter(Boolean).join(' ');

  return (
    <a
      href={dexScreenerUrl(mint)}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className={classes}
      onClick={handleClick}
    >
      {children}
    </a>
  );
}
