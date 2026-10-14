// ============================================================================
// 轻量分级日志
// ============================================================================

const COLORS: Record<string, string> = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function ts(): string {
  return new Date().toISOString().slice(11, 19);
}

function paint(color: string, s: string): string {
  return `${COLORS[color] ?? ''}${s}${COLORS.reset}`;
}

export const logger = {
  info(msg: string): void {
    console.log(`${paint('dim', `[${ts()}]`)} ${paint('cyan', 'INFO')}  ${msg}`);
  },
  warn(msg: string): void {
    console.log(`${paint('dim', `[${ts()}]`)} ${paint('yellow', 'WARN')}  ${msg}`);
  },
  error(msg: string): void {
    console.log(`${paint('dim', `[${ts()}]`)} ${paint('red', 'ERROR')} ${msg}`);
  },
  success(msg: string): void {
    console.log(`${paint('dim', `[${ts()}]`)} ${paint('green', 'OK')}    ${msg}`);
  },
  verdict(msg: string): void {
    console.log(`${paint('dim', `[${ts()}]`)} ${paint('magenta', 'TRADE')} ${msg}`);
  },
};
