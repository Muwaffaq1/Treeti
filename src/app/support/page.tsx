import type {Metadata} from 'next';
import {listed} from '@/lib/listed';
import {Support} from '@/components/legal';
export const metadata:Metadata={title:'Help and support',description:'How to reach treeti for help with your account or records.',...listed('/support')};
export default function SupportPage(){return <Support/>;}
