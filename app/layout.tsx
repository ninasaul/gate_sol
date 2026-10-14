import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  description: 'GateSol — Solana meme filter gates and paper-trading dashboard',
};

const themeBootScript = `(function(){try{var k='gatesol-theme';var s=localStorage.getItem(k)||localStorage.getItem('solshot-theme');var t=s==='light'||s==='dark'?s:(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

const localeBootScript = `(function(){try{var k='gatesol-locale';var s=localStorage.getItem(k);var language=(navigator.language||'').toLowerCase();var locale=s==='zh'||s==='en'?s:(language.indexOf('zh')===0?'zh':'en');document.documentElement.lang=locale==='zh'?'zh-CN':'en';document.documentElement.setAttribute('data-locale',locale);document.title=locale==='zh'?'GateSol · 实时信号':'GateSol · Live Signals';}catch(e){document.documentElement.lang='en';}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <script dangerouslySetInnerHTML={{ __html: localeBootScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Instrument+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
