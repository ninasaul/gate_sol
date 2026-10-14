import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { bus } from './state/event-bus.js';
import { buildDashboardState } from './api/snapshot.js';
import type { Pipeline } from './pipeline.js';
import { logger } from './utils/logger.js';

// ============================================================================
// Bot API 服务 —— 仅提供 /api/state 快照与 /api/events SSE（静态页由 Next.js 托管）
// ============================================================================

export class DashboardServer {
  private server: Server | null = null;
  private clients = new Set<ServerResponse>();
  private unsubs: Array<() => void> = [];
  private startedAt = Date.now();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(
    private pipeline: Pipeline,
    private port: number,
  ) {}

  async start(): Promise<void> {
    this.unsubs.push(bus.on('signal', (payload) => this.broadcast('signal', payload)));
    this.unsubs.push(bus.on('open', (payload) => this.broadcast('open', payload)));
    this.unsubs.push(bus.on('close', (payload) => this.broadcast('close', payload)));
    this.unsubs.push(bus.on('observe', (payload) => this.broadcast('observe', payload)));
    this.unsubs.push(bus.on('quote', (payload) => this.broadcast('quote', payload)));

    this.server = createServer((request, response) => this.handle(request, response));
    await new Promise<void>((resolve) => {
      this.server!.listen(this.port, () => resolve());
    });
    logger.info(`Bot API 已启动：http://127.0.0.1:${this.port}  (/api/state · /api/events)`);

    this.heartbeatTimer = setInterval(() => this.broadcastRaw(': ping\n\n'), 15_000);
  }

  async stop(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    for (const unsubscribe of this.unsubs) unsubscribe();
    this.unsubs = [];
    for (const client of this.clients) client.end();
    this.clients.clear();
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
      this.server = null;
    }
  }

  private handle(request: IncomingMessage, response: ServerResponse): void {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const path = url.pathname;

    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    if (path === '/api/state') {
      this.sendState(response);
      return;
    }
    if (path === '/api/events') {
      this.sse(response);
      return;
    }
    if (path === '/health') {
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ ok: true, startedAt: this.startedAt }));
      return;
    }

    response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: 'not_found' }));
  }

  private sendState(response: ServerResponse): void {
    const body = buildDashboardState(this.pipeline, this.startedAt);
    response.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    response.end(JSON.stringify(body));
  }

  private sse(response: ServerResponse): void {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    response.write('retry: 2000\n\n');
    this.clients.add(response);
    response.on('close', () => this.clients.delete(response));
  }

  private broadcast(event: string, data: unknown): void {
    this.broadcastRaw(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  private broadcastRaw(chunk: string): void {
    for (const client of this.clients) client.write(chunk);
  }
}
