// treeti's icon set: Kubai Icons (MIT, github.com/kubai087/kubai-icons).
// Each icon is imported from its own module so the Worker only carries the icons treeti uses.
// Names match the Lucide names the screens were written with, so screens import from here.
// Objects (home, wallet, bell) use Kubai. Controls (arrows, chevrons, menu, check, cross, plus, spinner)
// are simple line marks drawn below: Kubai draws arrows inside a disc, which turns to a dot at 16px.
import type {SVGProps} from 'react';
import Archive from 'kubai-icons-react/icons/archive';
import ArchiveRestore from 'kubai-icons-react/icons/undo';
import BadgeCheck from 'kubai-icons-react/icons/badge-verified';
import Banknote from 'kubai-icons-react/icons/banknote';
import Bell from 'kubai-icons-react/icons/bell';
import BellRing from 'kubai-icons-react/icons/bell-ring';
import BookOpen from 'kubai-icons-react/icons/book-open';
import CalendarDays from 'kubai-icons-react/icons/calendar-days';
import CalendarPlus from 'kubai-icons-react/icons/calendar-plus';
import CheckCircle2 from 'kubai-icons-react/icons/circle-check';
import CircleHelp from 'kubai-icons-react/icons/circle-help';
import Clock3 from 'kubai-icons-react/icons/clock';
import Copy from 'kubai-icons-react/icons/copy';
import Download from 'kubai-icons-react/icons/download';
import FileCheck2 from 'kubai-icons-react/icons/file-check';
import FileText from 'kubai-icons-react/icons/file-text';
import HeartHandshake from 'kubai-icons-react/icons/hand-heart';
import History from 'kubai-icons-react/icons/history';
import Home from 'kubai-icons-react/icons/home';
import Info from 'kubai-icons-react/icons/info';
import Laptop from 'kubai-icons-react/icons/laptop';
import Layers3 from 'kubai-icons-react/icons/layers';
import LockKeyhole from 'kubai-icons-react/icons/lock-keyhole';
import LogOut from 'kubai-icons-react/icons/log-out';
import Mail from 'kubai-icons-react/icons/mail';
import MessageCircle from 'kubai-icons-react/icons/message-circle';
import MessageSquareText from 'kubai-icons-react/icons/message-square';
import Moon from 'kubai-icons-react/icons/moon';
import NotebookPen from 'kubai-icons-react/icons/notebook-pen';
import Pencil from 'kubai-icons-react/icons/pencil';
import Search from 'kubai-icons-react/icons/search';
import Send from 'kubai-icons-react/icons/send';
import Sprout from 'kubai-icons-react/icons/sprout';
import Settings from 'kubai-icons-react/icons/settings';
import Eye from 'kubai-icons-react/icons/eye';
import Share2 from 'kubai-icons-react/icons/share';
import ShieldCheck from 'kubai-icons-react/icons/shield-check';
import Smartphone from 'kubai-icons-react/icons/smartphone';
import Star from 'kubai-icons-react/icons/star';
import Sun from 'kubai-icons-react/icons/sun';
import TriangleAlert from 'kubai-icons-react/icons/triangle-alert';
import UserRound from 'kubai-icons-react/icons/user-round';
import Users from 'kubai-icons-react/icons/users';
import UsersRound from 'kubai-icons-react/icons/users-round';
import WalletCards from 'kubai-icons-react/icons/wallet';
import WifiOff from 'kubai-icons-react/icons/wifi-off';

type GlyphProps=Omit<SVGProps<SVGSVGElement>,'ref'>&{size?:number|string};
export type IconComponent=typeof Bell|((props:GlyphProps)=>React.JSX.Element);

function glyph(name:string,paths:React.ReactNode){
  function Glyph({size=24,className,...rest}:GlyphProps){
    return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={['treeti-glyph',`treeti-glyph-${name}`,className].filter(Boolean).join(' ')} {...rest}>{paths}</svg>;
  }
  Glyph.displayName=name;
  return Glyph;
}
export const Check=glyph('check',<path d="M5 12.5l4.5 4.5L19 7.5"/>);
export const X=glyph('x',<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>);
export const Plus=glyph('plus',<path d="M12 5.5v13M5.5 12h13"/>);
export const ArrowLeft=glyph('arrow-left',<path d="M19 12H5.5M11 6l-6 6 6 6"/>);
export const ArrowRight=glyph('arrow-right',<path d="M5 12h13.5M13 6l6 6-6 6"/>);
export const ArrowUpRight=glyph('arrow-up-right',<path d="M7 17L17 7M8.5 7H17v8.5"/>);
export const ChevronDown=glyph('chevron-down',<path d="M6.5 9.5L12 15l5.5-5.5"/>);
export const ChevronUp=glyph('chevron-up',<path d="M6.5 14.5L12 9l5.5 5.5"/>);
export const ChevronRight=glyph('chevron-right',<path d="M9.5 6.5L15 12l-5.5 5.5"/>);
export const MoreHorizontal=glyph('more-horizontal',<><circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none"/></>);
export const Menu=glyph('menu',<path d="M4.5 7h15M4.5 12h15M4.5 17h15"/>);
export const LoaderCircle=glyph('loader',<path d="M20 12a8 8 0 1 1-8-8"/>);

export {Archive,ArchiveRestore,BadgeCheck,Banknote,Bell,BellRing,BookOpen,CalendarDays,CalendarPlus,CheckCircle2,CircleHelp,Clock3,Copy,Download,FileCheck2,FileText,HeartHandshake,History,Home,Info,Laptop,Layers3,LockKeyhole,LogOut,Mail,MessageCircle,MessageSquareText,Moon,NotebookPen,Pencil,Search,Send,Share2,ShieldCheck,Eye,Settings,Smartphone,Sprout,Star,Sun,TriangleAlert,UserRound,Users,UsersRound,WalletCards,WifiOff};
// Lucide had separate names for these; Kubai covers them with the same icon.
export {NotebookPen as FilePenLine,MessageSquareText as MessageSquareMore};
