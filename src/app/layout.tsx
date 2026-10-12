import type { Metadata,Viewport } from 'next';
import {PwaProvider} from '@/components/pwa';
import {AppearanceProvider} from '@/components/appearance';
import {appearanceBootstrap} from '@/lib/appearance';
import '@fontsource/geist/400.css';
import '@fontsource/geist/500.css';
import '@fontsource/geist/600.css';
import '@fontsource/geist/700.css';
import '@fontsource/lora/400.css';
import '@fontsource/lora/500.css';
import './globals.css';
import './design-system.css';
import './appearance.css';
const preview={title:'treeti — put it in writing, keep the trust',description:'A private record for interest-free agreements between people. Agree the terms together, add a witness, and track every repayment.',image:{url:'/og/treeti-link-preview.png',width:1200,height:630,alt:'treeti. Put it in writing. Keep the trust.'}};
export const metadata:Metadata={metadataBase:new URL('https://usetreeti.xyz'),title:{default:'treeti — clarity today, trust tomorrow',template:'%s · treeti'},description:'A private, thoughtful record of interest-free agreements between people.',openGraph:{type:'website',siteName:'treeti',url:'/',title:preview.title,description:preview.description,images:[preview.image]},twitter:{card:'summary_large_image',title:preview.title,description:preview.description,images:[preview.image]},robots:{index:false,follow:false},applicationName:'treeti',appleWebApp:{capable:true,title:'treeti',statusBarStyle:'default'},icons:{icon:[{url:'/icons/treeti.svg',type:'image/svg+xml'},{url:'/icons/treeti-favicon-32.png',sizes:'32x32',type:'image/png'}],apple:'/icons/treeti-apple.png'}};
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#f3ede2'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><head><script id="ahd-appearance" dangerouslySetInnerHTML={{__html:appearanceBootstrap}}/></head><body><AppearanceProvider><PwaProvider>{children}</PwaProvider></AppearanceProvider></body></html>;}
