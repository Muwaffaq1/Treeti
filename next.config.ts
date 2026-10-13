import type { NextConfig } from 'next';
import { securityHeaders } from './scripts/security-headers.mjs';
const config: NextConfig = {
  serverExternalPackages: ['@react-pdf/renderer'],
  async headers() { return [{ source: '/:path*', headers: securityHeaders(process.env.NODE_ENV==='development') }]; }
};
export default config;
