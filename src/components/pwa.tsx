'use client';
import {createContext,useContext,useEffect,useState,type ReactNode,type RefObject} from 'react';
import {Download,Share2,Smartphone,WifiOff} from 'lucide-react';
import {Button,ErrorMessage,Modal} from './ui';
type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>};
const PwaContext=createContext<{installEvent:InstallEvent|null;installed:boolean}>({installEvent:null,installed:false});
export function PwaProvider({children}:{children:ReactNode}){
  const [installEvent,setInstallEvent]=useState<InstallEvent|null>(null),[installed,setInstalled]=useState(false),[offline,setOffline]=useState(false);
  useEffect(()=>{
    const media=window.matchMedia('(display-mode: standalone)'),update=()=>setInstalled(media.matches||(navigator as Navigator&{standalone?:boolean}).standalone===true);
    const ready=(event:Event)=>{event.preventDefault();setInstallEvent(event as InstallEvent);},done=()=>{setInstalled(true);setInstallEvent(null);},connection=()=>setOffline(!navigator.onLine);
    window.addEventListener('beforeinstallprompt',ready);window.addEventListener('appinstalled',done);window.addEventListener('online',connection);window.addEventListener('offline',connection);media.addEventListener('change',update);
    const initial=setTimeout(()=>{update();connection();},0);
    if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(()=>{});
    return ()=>{clearTimeout(initial);window.removeEventListener('beforeinstallprompt',ready);window.removeEventListener('appinstalled',done);window.removeEventListener('online',connection);window.removeEventListener('offline',connection);media.removeEventListener('change',update);};
  },[]);
  return <PwaContext.Provider value={{installEvent,installed}}>{offline&&<div className="offline-status" role="status"><WifiOff size={16} aria-hidden/> You’re offline. Reconnect before saving changes.</div>}{children}</PwaContext.Provider>;
}
export function useTreetiInstallation(returnFocus?:RefObject<HTMLElement|null>){
  const {installEvent,installed}=useContext(PwaContext),[show,setShow]=useState(false),[error,setError]=useState('');
  async function install(){setError('');if(!installEvent){setShow(true);return;}try{await installEvent.prompt();await installEvent.userChoice;}catch{setError('Open your browser menu and choose Install app or Add to Home Screen.');setShow(true);}}
  const dialog=<Modal returnFocus={returnFocus} open={show} onOpenChange={setShow} title="treeti, a tap away" description="Add treeti to your home screen or desktop. It opens in its own window, just like an app."><ol className="install-help"><li><strong><Share2 size={18} aria-hidden/> iPhone or iPad</strong>Open treeti in Safari, tap Share, then choose Add to Home Screen.</li><li><strong><Smartphone size={18} aria-hidden/> Android</strong>Open treeti in Chrome, tap the menu, then Install app or Add to Home Screen.</li><li><strong><Download size={18} aria-hidden/> Desktop</strong>Use your browser’s install icon or menu. In Safari, choose File → Add to Dock.</li></ol><p className="install-privacy">An internet connection is needed to view and update your private records. Calendar reminders can alert you while treeti is closed.</p><ErrorMessage message={error}/><div className="dialog-actions"><Button onClick={()=>setShow(false)}>Got it</Button></div></Modal>;
  return {installed,install,dialog};
}

export function InstallTreeti({compact=false,rail=false}:{compact?:boolean;rail?:boolean}){
  const {installed,install,dialog}=useTreetiInstallation();
  if(installed)return null;
  return <><Button variant="secondary" className={compact?'icon-button':undefined} onClick={()=>void install()} aria-label={compact?'Install treeti':undefined}><Download size={19} aria-hidden/>{!compact&&(rail?<span><strong>Keep treeti close</strong><small>Install on your device</small></span>:'Install treeti')}</Button>{dialog}</>;
}
