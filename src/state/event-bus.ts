// ============================================================================
// 轻量事件总线 —— 把机器人的实时信号/开仓/平仓事件广播给 Web 看板（SSE）
// ============================================================================

export interface SignalEvent {
  symbol: string;
  mint: string;
  imageUrl: string | null;
  dex: string;
  verdict: string;
  checks: { security: boolean; liquidity: boolean; holders: boolean };
  reasons: string[];
  priceUsd: number;
  marketCapUsd: number;
  liquidityUsd: number;
  devPct: number;
  whaleCount: number;
  ts: number;
}

export interface QuoteEvent {
  mint: string;
  priceUsd: number;
  marketCapUsd: number;
  ts: number;
}

export interface OpenEvent {
  symbol: string;
  sizeUsd: number;
  entryPriceUsd: number;
  ts: number;
}

export interface CloseEvent {
  symbol: string;
  pnlUsd: number;
  pnlPct: number;
  reason: string;
  ts: number;
}

export interface ObserveEvent {
  symbol: string;
  mint: string;
  reasons: string[];
  ts: number;
}

export interface DashboardEvents {
  signal: SignalEvent;
  open: OpenEvent;
  close: CloseEvent;
  observe: ObserveEvent;
  quote: QuoteEvent;
}

type Handler<T> = (data: T) => void;
type AnyHandler = Handler<DashboardEvents[keyof DashboardEvents]>;

class EventBus {
  private handlers = new Map<keyof DashboardEvents, Set<AnyHandler>>();

  on<K extends keyof DashboardEvents>(event: K, handler: Handler<DashboardEvents[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as AnyHandler);
    return () => set?.delete(handler as AnyHandler);
  }

  emit<K extends keyof DashboardEvents>(event: K, data: DashboardEvents[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of set) (handler as Handler<DashboardEvents[K]>)(data);
  }
}

export const bus = new EventBus();
