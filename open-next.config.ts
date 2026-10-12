import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Authenticated pages and private artifacts never use a shared ISR/R2 cache.
const config = defineCloudflareConfig();
config.buildCommand = 'node scripts/build-worker.mjs';
export default config;
