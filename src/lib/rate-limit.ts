import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { sha256 } from './crypto';
import { DomainError } from '@/modules/agreements/domain';
const local=globalThis as typeof globalThis&{ahdLimits?:Map<string,{count:number;until:number}>};
const limits=local.ahdLimits??=new Map();
export const sharedRateLimitConfigured = () => !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;
export async function rateLimit(key:string,max=15,demo=false){
  const safe=sha256(key);
  if(sharedRateLimitConfigured()){const r=new Ratelimit({redis:Redis.fromEnv(),limiter:Ratelimit.slidingWindow(max,'10 m'),prefix:'ahd:limit'});if(!(await r.limit(safe)).success)throw new DomainError('RATE_LIMITED','Please wait a few minutes before trying again.',429);return;}
  if(process.env.NODE_ENV==='production'&&!demo)throw new DomainError('RATE_LIMIT_SETUP_REQUIRED','Secure verification is temporarily unavailable. Please try again later.',503);
  const prior=limits.get(safe),now=Date.now();const entry=prior&&prior.until>now?prior:{count:0,until:now+600000};entry.count++;limits.set(safe,entry);
  if(limits.size>5000)for(const [k,v]of limits)if(v.until<now)limits.delete(k);
  if(entry.count>max)throw new DomainError('RATE_LIMITED','Please wait a few minutes before trying again.',429);
}
