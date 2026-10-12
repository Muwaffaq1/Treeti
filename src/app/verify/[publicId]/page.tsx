import {Verification} from '@/components/verification';
import Link from 'next/link';
export default async function VerifyPage({params}:{params:Promise<{publicId:string}>}){const {publicId}=await params;return <main className="public-invitation"><Link className="back-link" href="/">Return to treeti</Link><Verification publicId={publicId} demo={false}/></main>;}
