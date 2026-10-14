'use client';

import type { MouseEvent, ReactNode } from 'react';
import { dexScreenerUrl } from '@/lib/token-links';
import { useLocale } from '@/lib/use-locale';

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
  title,
  stopPropagation = false,
}: TokenLinkProps) {
  const { messages } = useLocale();
  const linkTitle = title ?? messages.token.openDex;
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (stopPropagation) event.stopPropagation();
  };

  const classes = ['ui-link', className].filter(Boolean).join(' ');

  return (
    <a
      href={dexScreenerUrl(mint)}
      target="_blank"
      rel="noopener noreferrer"
      title={linkTitle}
      className={classes}
      onClick={handleClick}
    >
      {children}
    </a>
  );
}
