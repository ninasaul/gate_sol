import type { NextConfig } from 'next';

const botApiPort = Number(process.env.BOT_API_PORT ?? 3940);
const botOrigin = `http://127.0.0.1:${Number.isFinite(botApiPort) ? botApiPort : 3940}`;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${botOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
