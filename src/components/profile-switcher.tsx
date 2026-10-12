'use client';
import * as Select from '@radix-ui/react-select';
import {useEffect,useState} from 'react';
import {Check,ChevronDown,ChevronUp} from 'lucide-react';
import type {Actor} from '@/modules/agreements/types';

const initials=(name:string)=>name.split(' ').map(part=>part[0]).slice(0,2).join('');
export function ProfileSwitcher({actor,people,disabled,onChange}:{actor:Actor;people:Actor[];disabled:boolean;onChange:(id:string)=>void}){
  const [open,setOpen]=useState(false);
  useEffect(()=>()=>{const shell=document.querySelector<HTMLElement>('.app-shell');if(shell)shell.inert=false;},[]);
  function changeOpen(value:boolean){setOpen(value);const shell=document.querySelector<HTMLElement>('.app-shell');if(shell)shell.inert=value;}
  return <Select.Root value={actor.userId} onValueChange={onChange} disabled={disabled} open={open} onOpenChange={changeOpen}>
    <Select.Trigger className="profile-switch-trigger" aria-label="View demonstration as" data-profile-id={actor.userId}>
      <span className="profile-switch-avatar" aria-hidden>{initials(actor.name)}</span><Select.Value/><Select.Icon className="profile-switch-chevron"><ChevronDown size={18} aria-hidden/></Select.Icon>
    </Select.Trigger>
    <Select.Portal><Select.Content className="profile-switch-menu" position="popper" sideOffset={8} align="end" collisionPadding={16}>
      <Select.ScrollUpButton className="profile-switch-scroll"><ChevronUp size={18} aria-hidden/></Select.ScrollUpButton>
      <Select.Viewport><Select.Group><Select.Label className="profile-switch-label">Switch demo profile</Select.Label>{people.map(person=><Select.Item key={person.userId} value={person.userId} className="profile-switch-item"><span className="profile-switch-avatar" aria-hidden>{initials(person.name)}</span><Select.ItemText>{person.name}</Select.ItemText><Select.ItemIndicator className="profile-switch-selected"><Check size={18} aria-hidden/></Select.ItemIndicator></Select.Item>)}</Select.Group></Select.Viewport>
      <Select.ScrollDownButton className="profile-switch-scroll"><ChevronDown size={18} aria-hidden/></Select.ScrollDownButton>
    </Select.Content></Select.Portal>
  </Select.Root>;
}
