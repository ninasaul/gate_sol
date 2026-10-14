export interface Messages {
  meta: {
    title: string;
    description: string;
  };
  topbar: {
    processed: string;
    winRate: string;
    thresholds: string;
    exportTrades: string;
    exportSignals: string;
    liveFeed: string;
    reconnect: string;
    themeToLight: string;
    themeToDark: string;
    themeLight: string;
    themeDark: string;
    switchLanguage: string;
  };
  status: {
    sseConnected: string;
    sseReconnecting: string;
    processed: (count: number) => string;
    open: (count: number) => string;
    win: (value: string) => string;
    profitFactor: (value: string) => string;
    pnl: (value: string) => string;
    disclaimer: string;
  };
  stage: {
    trend: string;
    signals: string;
    trades: string;
    symbol: string;
    pnl: string;
    reason: string;
    change: string;
    time: string;
    emptyTrades: string;
  };
  rail: {
    positions: string;
    emptyPositions: string;
    running: string;
    watch: string;
    emptyWatch: string;
    rejectTop: string;
    emptyReject: string;
    thresholds: string;
    liquidity: string;
    devCap: string;
    stopLoss: string;
    moon: string;
  };
  signal: {
    all: string;
    symbol: string;
    verdict: string;
    checks: string;
    reason: string;
    price: string;
    marketCap: string;
    liquidity: string;
    dev: string;
    time: string;
    empty: string;
    placeholder: string;
    checkSecurity: string;
    checkLiquidity: string;
    checkHolders: string;
    checkSecurityTitle: string;
    checkLiquidityTitle: string;
    checkHoldersTitle: string;
  };
  config: {
    heading: string;
    minLiquidity: string;
    requireLpLocked: string;
    yes: string;
    no: string;
    maxDev: string;
    maxTop10: string;
    whale: string;
    minHolders: string;
    positionSize: string;
    stopLoss: string;
    moonActivate: string;
    trailingStop: string;
    maxPositions: string;
    slippage: string;
  };
  drawer: {
    title: string;
    size: string;
    fill: string;
    mark: string;
    marketCap: string;
    unrealized: string;
    stop: string;
    moon: string;
    high: string;
    status: string;
    running: string;
    standard: string;
    held: string;
    mint: string;
    close: string;
    openDex: string;
  };
  chart: {
    total: string;
    realized: string;
    winTrade: string;
    lossTrade: string;
    empty: string;
  };
  token: {
    openDex: string;
  };
}
