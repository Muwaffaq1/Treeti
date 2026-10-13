import type {Metadata} from 'next';
import {listed} from '@/lib/listed';
import {Terms} from '@/components/legal';
export const metadata:Metadata={title:'Terms of use',description:'The understanding between you and treeti when you use it.',...listed('/terms')};
export default function TermsPage(){return <Terms/>;}
