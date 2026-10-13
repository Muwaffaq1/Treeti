import {Guide} from '@/components/shell';
import Link from 'next/link';
import type {Metadata} from 'next';
import {listed} from '@/lib/listed';
export const metadata:Metadata={title:'How treeti works',description:'How to record an agreement, add a witness, track repayments, and keep private notes of debts and investments.',...listed('/guide')};
export default function GuidePage(){return <main className="public-guide"><Link className="back-link" href="/">Return to treeti</Link><Guide/></main>;}
