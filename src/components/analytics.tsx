'use client';
import {usePathname} from 'next/navigation';
import {useEffect} from 'react';
import {trackScreen} from '@/lib/analytics';
/** Counts each screen opened, by kind of screen only. Sends nothing unless statistics are configured. */
export function ScreenStatistics(){const pathname=usePathname();useEffect(()=>{trackScreen(pathname);},[pathname]);return null;}
