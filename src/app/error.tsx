'use client';
import Link from 'next/link';
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="auth-panel"><h1>The page could not be loaded.</h1><p>Your records have not been changed. Check your connection and try again.</p><button className="button button-primary" onClick={reset}>Try again</button><Link href="/">Return to treeti</Link></main>;}
