'use client';

import Link from 'next/link';
import {useRef} from 'react';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import {Menu,UserRound,Sun,Moon,Download,CircleHelp,ArrowUpRight,Clock3,MessageSquareText,ShieldCheck} from 'lucide-react';
import type {Actor} from '@/modules/agreements/types';
import {useAppearance} from './appearance';
import {useTreetiInstallation} from './pwa';

export function UtilityMenu({actor,base,demo}:{actor:Actor;base:string;demo:boolean}){
  const trigger=useRef<HTMLButtonElement>(null);
  const {theme,setPreference}=useAppearance(),{installed,install,dialog}=useTreetiInstallation(trigger);
  const dark=theme==='dark',ThemeIcon=dark?Sun:Moon;
  return <><Dropdown.Root modal={false}>
    <Dropdown.Trigger ref={trigger} className="icon-button utility-menu-trigger" aria-label="Open menu"><Menu size={22} aria-hidden/></Dropdown.Trigger>
    <Dropdown.Portal><Dropdown.Content className="utility-menu" align="end" sideOffset={10} collisionPadding={16}>
      <Dropdown.Label className="utility-menu-profile"><span className="avatar" aria-hidden>{actor.name.split(' ').map(part=>part[0]).slice(0,2).join('')}</span><span><strong>{actor.name}</strong><small>{demo?'Demonstration profile':'Your account'}</small></span></Dropdown.Label>
      <Dropdown.Separator className="utility-menu-divider"/>
      <Dropdown.Item className="utility-menu-item" asChild><Link href={`${base}/activity`}><Clock3 size={20} aria-hidden/><span>Activity</span><ArrowUpRight size={16} aria-hidden/></Link></Dropdown.Item>
      <Dropdown.Item className="utility-menu-item" asChild><Link href={`${base}/account`}><UserRound size={20} aria-hidden/><span>Account</span><ArrowUpRight size={16} aria-hidden/></Link></Dropdown.Item>
      <Dropdown.Item className="utility-menu-item" asChild><Link href={`${base}/trusted-contacts`}><ShieldCheck size={20} aria-hidden/><span>Trusted contacts</span><ArrowUpRight size={16} aria-hidden/></Link></Dropdown.Item>
      <Dropdown.Item className="utility-menu-item" aria-label={`Switch to ${dark?'light':'dark'} mode`} onSelect={()=>setPreference(dark?'light':'dark')}><ThemeIcon size={20} aria-hidden/><span>{dark?'Light mode':'Dark mode'}</span></Dropdown.Item>
      {!installed&&<Dropdown.Item className="utility-menu-item" onSelect={()=>{requestAnimationFrame(()=>void install());}}><Download size={20} aria-hidden/><span>Install treeti</span></Dropdown.Item>}
      <Dropdown.Separator className="utility-menu-divider"/>
      <Dropdown.Item className="utility-menu-item" asChild><Link href={`${base}/guide`}><CircleHelp size={20} aria-hidden/><span>How treeti works</span><ArrowUpRight size={16} aria-hidden/></Link></Dropdown.Item>
      <Dropdown.Item className="utility-menu-item" asChild><Link href={`${base}/feedback`}><MessageSquareText size={20} aria-hidden/><span>Send feedback</span><ArrowUpRight size={16} aria-hidden/></Link></Dropdown.Item>
    </Dropdown.Content></Dropdown.Portal>
  </Dropdown.Root>{dialog}</>;
}
