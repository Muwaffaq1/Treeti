import type {Metadata} from 'next';
import {Terms} from '@/components/legal';
export const metadata:Metadata={title:'Terms of use',description:'The understanding between you and treeti when you use it.'};
export default function TermsPage(){return <Terms/>;}
