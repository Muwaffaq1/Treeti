'use client';

import Link from '@/components/app-link';
import {useRef} from 'react';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import {UserRound,Sun,Moon,Download,CircleHelp,ArrowUpRight,Clock3,MessageSquareText,ShieldCheck} from '@/components/icons';
import type {Actor} from '@/modules/agreements/types';
import {useAppearance} from './appearance';
import {useTreetiInstallation} from './pwa';

export function UtilityMenu({actor,base,demo,rail=false}:{actor:Actor;base:string;demo:boolean;rail?:boolean}){
  const short=actor.name.split(' ').map(part=>part[0]).slice(0,2).join('');
  const trigger=useRef<HTMLButtonElement>(null);
  const {theme,setPreference}=useAppearance(),{installed,install,dialog}=useTreetiInstallation(trigger);
  const dark=theme==='dark',ThemeIcon=dark?Sun:Moon;
  return <><Dropdown.Root modal={false}>
    {rail
      ?<Dropdown.Trigger ref={trigger} className="rail-account"><span className="kit-avatar" style={{'--size':'36px'} as React.CSSProperties} aria-hidden>{short}</span><span className="rail-account-text"><strong>{actor.name}</strong><small>Account</small></span></Dropdown.Trigger>
      :<Dropdown.Trigger ref={trigger} className="icon-button utility-menu-trigger" aria-label="Open menu"><span className="utility-menu-initials" aria-hidden>{short}</span></Dropdown.Trigger>}
    <Dropdown.Portal><Dropdown.Content className="utility-menu" align={rail?'start':'end'} side={rail?'top':'bottom'} sideOffset={10} collisionPadding={16}>
      <Dropdown.Label className="utility-menu-profile"><span className="avatar" aria-hidden>{actor.name.split(' ').map(part=>part[0]).slice(0,2).join('')}</span><span><strong>{actor.name}</strong><small>{demo?'Demonstration profile':'Your account'}</small></span></Dropdown.Label>
      <Dropdown.Separator className="utility-menu-divider"/>
      {!rail&&<Dropdown.Item className="utility-menu-item" asChild><Link href={`${base}/activity`}><Clock3 size={20} aria-hidden/><span>Activity</span><ArrowUpRight size={16} aria-hidden/></Link></Dropdown.Item>}
      <Dropdown.Item className="utility-menu-item" asChild><Link href={`${base}/account`}><UserRound size={20} aria-hidden/><span>Account</span><ArrowUpRight size={16} aria-hidden/></Link></Dropdown.Item>
      {!rail&&<Dropdown.Item className="utility-menu-item" asChild><Link href={`${base}/trusted-contacts`}><ShieldCheck size={20} aria-hidden/><span>Trusted contacts</span><ArrowUpRight size={16} aria-hidden/></Link></Dropdown.Item>}
      <Dropdown.Item className="utility-menu-item" aria-label={`Switch to ${dark?'light':'dark'} mode`} onSelect={()=>setPreference(dark?'light':'dark')}><ThemeIcon size={20} aria-hidden/><span>{dark?'Light mode':'Dark mode'}</span></Dropdown.Item>
      {!installed&&<Dropdown.Item className="utility-menu-item" onSelect={()=>{requestAnimationFrame(()=>void install());}}><Download size={20} aria-hidden/><span>Install treeti</span></Dropdown.Item>}
      <Dropdown.Separator className="utility-menu-divider"/>
      <Dropdown.Item className="utility-menu-item" asChild><Link href={`${base}/guide`}><CircleHelp size={20} aria-hidden/><span>How treeti works</span><ArrowUpRight size={16} aria-hidden/></Link></Dropdown.Item>
      <Dropdown.Item className="utility-menu-item" asChild><Link href={`${base}/feedback`}><MessageSquareText size={20} aria-hidden/><span>Send feedback</span><ArrowUpRight size={16} aria-hidden/></Link></Dropdown.Item>
    </Dropdown.Content></Dropdown.Portal>
  </Dropdown.Root>{dialog}</>;
}
