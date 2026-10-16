import { logger } from '../utils/logger.js';
import type { ChainDiscovery } from './chain-scanner.js';

const PUMPPORTAL_WS = 'wss://pumpportal.fun/api/data';

export interface PumpPortalScannerOptions {
  onDiscovery: (event: ChainDiscovery) => void;
}

/**
 * PumpPortal 免费流（同一条 WS）：
 * - subscribeNewToken → 内盘刚 mint（pumpfun）
 * - subscribeMigration → 毕业上外盘（raydium / pump-amm）
 */
export class PumpPortalScanner {
  private socket: WebSocket | null = null;
  private stopped = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempt = 0;
  private readonly onDiscovery: (event: ChainDiscovery) => void;

  constructor(opts: PumpPortalScannerOptions) {
    this.onDiscovery = opts.onDiscovery;
  }

  async start(): Promise<() => void> {
    this.stopped = false;
    this.connect();
    logger.info(
      'PumpPortal 已启动：内盘 newToken + 外盘 migration（免费 WS，不打 Solana getTransaction）',
    );
    return () => this.stop();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    try {
      this.socket?.close();
    } catch {
      /* ignore */
    }
    this.socket = null;
  }

  private connect(): void {
    if (this.stopped) return;
    if (typeof WebSocket === 'undefined') {
      logger.warn('当前运行时无 WebSocket，无法启动 PumpPortal');
      return;
    }

    const socket = new WebSocket(PUMPPORTAL_WS);
    this.socket = socket;

    socket.addEventListener('open', () => {
      this.reconnectAttempt = 0;
      socket.send(JSON.stringify({ method: 'subscribeNewToken' }));
      socket.send(JSON.stringify({ method: 'subscribeMigration' }));
      logger.info('PumpPortal WebSocket 已连接（newToken + migration）');
    });

    socket.addEventListener('message', (event) => {
      if (this.stopped) return;
      try {
        const payload = JSON.parse(String(event.data)) as Record<string, unknown>;
        // 握手/状态消息无 mint，跳过
        if (payload.message && !payload.mint) return;
        const mint = String(payload.mint ?? '').trim();
        if (!mint) return;

        const migration = this.isMigrationPayload(payload);
        const name = String(payload.name ?? '').trim() || null;
        const symbol = String(payload.symbol ?? '').trim() || null;
        const uri = String(payload.uri ?? '').trim() || null;
        const imageUrl =
          uri && /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(uri) ? uri : null;
        const poolAddress = this.resolvePoolAddress(payload);

        this.onDiscovery({
          mint,
          dex: migration ? 'raydium' : 'pumpfun',
          signature: String(payload.signature ?? payload.tx ?? mint),
          poolAddress,
          programKind: migration ? 'migration' : 'pump',
          name,
          symbol,
          imageUrl,
          uri,
        });
      } catch (error) {
        logger.warn(
          `PumpPortal 消息解析失败：${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });

    socket.addEventListener('close', () => {
      if (this.stopped) return;
      logger.warn('PumpPortal WebSocket 断开，准备重连');
      this.scheduleReconnect();
    });

    socket.addEventListener('error', () => {
      /* close 会随后触发 */
    });
  }

  private isMigrationPayload(payload: Record<string, unknown>): boolean {
    const txType = String(payload.txType ?? payload.type ?? '').toLowerCase();
    if (txType === 'migrate' || txType === 'migration') return true;
    const pool = String(payload.pool ?? '').toLowerCase();
    if (
      pool === 'raydium' ||
      pool === 'raydium-cpmm' ||
      pool === 'pump-amm' ||
      pool === 'pumpswap' ||
      pool === 'pump amm'
    ) {
      return true;
    }
    return Boolean(payload.migration);
  }

  private resolvePoolAddress(payload: Record<string, unknown>): string | null {
    const candidates = [
      payload.poolAddress,
      payload.poolId,
      payload.bondingCurveKey,
      payload.market,
    ];
    for (const value of candidates) {
      const text = String(value ?? '').trim();
      if (text && text.length >= 32) return text;
    }
    return null;
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    this.reconnectAttempt += 1;
    const delayMs = Math.min(60_000, 2_000 * 2 ** Math.min(this.reconnectAttempt - 1, 5));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delayMs);
  }
}
