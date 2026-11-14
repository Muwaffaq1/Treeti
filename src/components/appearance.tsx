'use client';

import {createContext,useContext,useSyncExternalStore} from 'react';
import {Laptop,Moon,Sun} from '@/components/icons';

type Preference='light'|'dark'|'system';
type Appearance={preference:Preference;theme:'light'|'dark';setPreference:(value:Preference)=>void};
const key='ahd:appearance',changed='ahd:appearance-changed';
let temporaryPreference:Preference|undefined;
const AppearanceContext=createContext<Appearance|null>(null);

function preference():Preference{
  if(temporaryPreference)return temporaryPreference;
  try{const value=localStorage.getItem(key);if(value==='light'||value==='dark')return value;}catch{}
  return 'system';
}
function snapshot(){const p=preference();return `${p}:${p==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p}`;}
function apply(){const theme=snapshot().split(':')[1];document.documentElement.dataset.theme=theme;document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(meta=>{meta.content=theme==='dark'?'#111111':'#f3ede2';});}
function subscribe(update:()=>void){
  const media=matchMedia('(prefers-color-scheme: dark)');
  function refresh(){apply();update();}
  function storage(event:StorageEvent){if(event.key===key||event.key===null){temporaryPreference=undefined;refresh();}}
  media.addEventListener('change',refresh);window.addEventListener(changed,refresh);window.addEventListener('storage',storage);apply();
  return ()=>{media.removeEventListener('change',refresh);window.removeEventListener(changed,refresh);window.removeEventListener('storage',storage);};
}
function setPreference(value:Preference){temporaryPreference=value;try{localStorage.setItem(key,value);}catch{}apply();window.dispatchEvent(new Event(changed));}
export function AppearanceProvider({children}:{children:React.ReactNode}){
  const value=useSyncExternalStore(subscribe,snapshot,()=> 'system:light');
  const [p,theme]=value.split(':') as [Preference,'light'|'dark'];
  return <AppearanceContext.Provider value={{preference:p,theme,setPreference}}>{children}</AppearanceContext.Provider>;
}
export function useAppearance(){const value=useContext(AppearanceContext);if(!value)throw new Error('Appearance controls require the provider.');return value;}
export function ThemeToggle({compact=false}:{compact?:boolean}){
  const {theme,setPreference}=useAppearance(),dark=theme==='dark',Icon=dark?Sun:Moon,label=`Switch to ${dark?'light':'dark'} mode`;
  return <button type="button" className={compact?'icon-button theme-toggle':'theme-rail'} aria-label={label} title={label} onClick={()=>setPreference(dark?'light':'dark')}><Icon size={20} aria-hidden/>{!compact&&<span>{dark?'Light mode':'Dark mode'}</span>}</button>;
}
export function AppearanceSettings({compact=false}:{compact?:boolean}){
  const {preference,setPreference}=useAppearance();
  if(compact)return <fieldset className="account-row account-appearance"><legend className="sr-only">Appearance</legend><span aria-hidden><strong>Appearance</strong></span><div className="account-segment">{([{value:'light',label:'Light'},{value:'dark',label:'Dark'},{value:'system',label:'Device'}] as const).map(({value,label})=><button key={value} type="button" aria-pressed={preference===value} onClick={()=>setPreference(value)}>{label}</button>)}</div></fieldset>;
  return <fieldset className="appearance-settings"><legend>Appearance</legend><p>Choose a theme, or follow your device setting.</p><div className="appearance-options">{([{value:'light',label:'Light',Icon:Sun},{value:'dark',label:'Dark',Icon:Moon},{value:'system',label:'Device',Icon:Laptop}] as const).map(({value,label,Icon})=><button key={value} type="button" aria-pressed={preference===value} onClick={()=>setPreference(value)}><Icon size={18} aria-hidden/>{label}</button>)}</div></fieldset>;
}
