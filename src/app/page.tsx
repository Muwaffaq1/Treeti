import type {Metadata} from 'next';
import {listed} from '@/lib/listed';
import Link from '@/components/app-link';
import {Check} from '@/components/icons';
import {LegalLinks} from '@/components/legal';
import {PublicHeader} from '@/components/auth';
import {demoEnabled} from '@/modules/agreements/demo';
import {LandingCard} from '@/components/landing-card';
export const metadata:Metadata=listed('/');
// Landing (Figma: Public · Landing 174:10268, Desktop · Landing 175:10321).
export default function Home(){
  const steps=[['Write it in one sentence','Who, how much, what for, and how it’s repaid. Add witnesses if you like.'],['Agree it together','Everyone reads it and signs with their name. Nothing is agreed until they do.'],['Keep track kindly','Record payments, see what’s left, and offer forgiveness if you choose.']];
  return <div className="public-page landing-v3"><a href="#main" className="skip-link">Skip to content</a>
    <PublicHeader signIn links/>
    <main id="main">
      <section className="landing-hero-v3">
        <div className="landing-copy">
          <h1>Put it in writing.<br/>Keep the trust.</h1>
          <p>Write down what you lend, agree it together, and keep track of every payment. Interest-free, always.</p>
          <div className="landing-actions"><Link className="brief-cta" href="/login">Write your first agreement</Link>{demoEnabled()&&<Link className="kit-link landing-demo" href="/demo">Try the demo first</Link>}</div>
          <ul className="landing-checks">{['Private','Interest-free','Signed by both'].map(t=><li key={t}><Check size={14} aria-hidden/>{t}</li>)}</ul>
        </div>
        <LandingCard/>
      </section>
      <section className="landing-steps" aria-label="How treeti works">{steps.map(([title,body],i)=><article key={title}><span className="landing-step-number" aria-hidden>{i+1}</span><h2>{title}</h2><p>{body}</p></article>)}</section>
    </main>
    <footer className="landing-footer-v3"><p>treeti records agreements. It doesn’t lend, hold or move money.</p><LegalLinks/></footer>
  </div>;
}
