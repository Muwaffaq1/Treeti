import type {Metadata} from 'next';
import {listed} from '@/lib/listed';
import {Privacy} from '@/components/legal';
export const metadata:Metadata={title:'Privacy policy',description:'What treeti collects, why, who can see it, and the choices you have.',...listed('/privacy')};
export default function PrivacyPage(){return <Privacy/>;}
