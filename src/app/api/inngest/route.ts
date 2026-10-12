import { serve } from 'inngest/next';
import { inngest, functions } from '@/modules/notifications/worker';
export const runtime='nodejs';
export const { GET, POST, PUT }=serve({client:inngest,functions});
