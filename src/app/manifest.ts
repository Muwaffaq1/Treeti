import type {MetadataRoute} from 'next';
export default function manifest():MetadataRoute.Manifest{return {
  id:'/launch',name:'treeti — agreements & private debts',short_name:'treeti',description:'Clear agreements, private debt records and thoughtful reminders.',
  start_url:'/launch',scope:'/',display:'standalone',background_color:'#f3ede2',theme_color:'#f3ede2',lang:'en',categories:['finance','productivity'],
  icons:[{src:'/icons/treeti-192.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'/icons/treeti-512.png',sizes:'512x512',type:'image/png',purpose:'any'},{src:'/icons/treeti-maskable-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}],
  shortcuts:[{name:'My debts',url:'/launch?view=debts',description:'Review your private debt records'},{name:'New agreement',url:'/launch?view=new',description:'Propose an interest-free agreement'}],
};}
