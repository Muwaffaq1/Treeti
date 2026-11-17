import NextLink from 'next/link';
import type {ComponentProps} from 'react';

/**
 * next/link without background prefetching. Next prefetches every link it can see, and on
 * Cloudflare's free plan each prefetch can land on a fresh Worker and spend hundreds of
 * milliseconds of CPU, using up the allowance that real actions (like sending an agreement) need.
 * Pass prefetch explicitly where a link is worth warming up.
 */
export default function Link({prefetch=false,...props}:ComponentProps<typeof NextLink>){
  return <NextLink prefetch={prefetch} {...props}/>;
}
