import Link from 'next/link';
import {ArrowLeft} from 'lucide-react';
import {Brand} from '@/components/shell';

export const OPERATOR='Muwaffaq Yusuf';
export const CONTACT_EMAIL='yusufmuwaffaq17@gmail.com';
const UPDATED='13 October 2026';
const mail=(subject:string)=>`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;

export function LegalLinks(){return <nav className="legal-links" aria-label="Policies and support"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/support">Support</Link></nav>;}

function LegalPage({title,lede,dated=true,children}:{title:string;lede:string;dated?:boolean;children:React.ReactNode}){
  return <main className="public-guide legal"><Link href="/" aria-label="treeti home"><Brand/></Link><Link className="back-link" href="/"><ArrowLeft size={16}/>Return to treeti</Link><h1>{title}</h1><p className="lede">{lede}</p>{dated&&<p className="legal-updated">Last updated {UPDATED}</p>}{children}<footer className="legal-footer"><LegalLinks/></footer></main>;
}
const Email=({subject}:{subject:string})=><a className="legal-email" href={mail(subject)}>{CONTACT_EMAIL}</a>;

export function Privacy(){return <LegalPage title="Privacy policy" lede="What treeti collects, why, who can see it, and the choices you have.">
  <h2>Who runs treeti</h2>
  <p>treeti is operated by {OPERATOR}, an individual based in Nigeria (“we”, “us”). For any privacy question or request, write to <Email subject="treeti privacy request"/>.</p>
  <h2>What we collect</h2>
  <ul>
    <li><strong>Your account.</strong> Your email address, the name you give us, and the sign-in codes and sessions needed to verify it is you.</li>
    <li><strong>Agreements you take part in.</strong> The names and contact details of the lender, borrower and any witnesses, the amount, currency, dates, repayment plan, any purpose or extra terms you write, each person’s approval or acknowledgment, repayments recorded and confirmed, and any payment proof or reference you choose to add.</li>
    <li><strong>Your private records.</strong> Debts you track for yourself, reminders you set, and investments you record.</li>
    <li><strong>Technical information.</strong> Limited details such as your IP address and the time of a request, used to keep sign-in secure and to prevent abuse, and a history of actions taken on each agreement.</li>
  </ul>
  <p>When you invite someone to an agreement, you give us that person’s name and email so the agreement can be matched to them when they sign in. treeti does not email them: you share the private link yourself. Please only invite people who are expecting it.</p>
  <h2>How we use it</h2>
  <ul>
    <li>To keep the record you and the other people agreed to, and show it to the people it belongs to.</li>
    <li>To email you a sign-in code, and to show notifications and the reminders you ask for inside treeti.</li>
    <li>To protect accounts, investigate problems and prevent misuse.</li>
    <li>To meet legal obligations where they apply.</li>
  </ul>
  <p>We do not sell your information, show advertising, or use advertising or analytics trackers.</p>
  <h2>Who can see your information</h2>
  <ul>
    <li><strong>An agreement</strong> is visible to its lender, its borrower and the witnesses invited to it.</li>
    <li><strong>Private debts, reminders and investments</strong> are visible only to you. The people you name in them are not told.</li>
    <li><strong>The operator</strong> can access records only when needed to run, secure or fix the service, or to answer a request you make.</li>
  </ul>
  <h2>Services we rely on</h2>
  <p>treeti runs on services from other companies, which process information on our behalf: Supabase (database, sign-in and private file storage), Cloudflare (hosting), Resend (email delivery), Inngest (scheduled background tasks) and Upstash (sign-in rate limits). These companies may process information outside Nigeria.</p>
  <h2>How long we keep it</h2>
  <p>We keep your records while your account is open. An agreement is a shared record: once the people involved have approved it, the exact version is preserved for all of them and cannot be removed by one person alone. If you ask us to delete your account, we delete your private debts, reminders and investments, and your sign-in details. Agreements you took part in may be kept for the other people who rely on them.</p>
  <h2>Keeping it safe</h2>
  <p>Records are sent over encrypted connections and stored in private storage, and uploaded documents can be opened only by the people entitled to them. No online service can promise perfect security, so please keep your own copy of any agreement PDF that matters to you.</p>
  <h2>Cookies and your browser</h2>
  <p>treeti uses only the cookies needed to keep you signed in, and remembers your light or dark appearance choice in your browser. It does not use tracking cookies.</p>
  <h2>Your choices</h2>
  <p>You can ask us for a copy of your information, to correct it, to delete your account, or to stop using it in a particular way. Write to <Email subject="treeti privacy request"/> from the email address on your account and we will reply as soon as we can, normally within 30 days. If you are in Nigeria and are unhappy with our answer, you can complain to the Nigeria Data Protection Commission.</p>
  <h2>Age</h2>
  <p>treeti is for adults. Please do not use it if you are under 18.</p>
  <h2>Changes</h2>
  <p>If this policy changes in a way that matters, we will update the date above and tell you in the app or by email.</p>
</LegalPage>;}

export function Terms(){return <LegalPage title="Terms of use" lede="The understanding between you and treeti when you use it.">
  <h2>What treeti is</h2>
  <p>treeti is a tool for recording interest-free agreements between people who know each other, and for keeping private notes about debts and investments. It is operated by {OPERATOR}, an individual based in Nigeria.</p>
  <p>treeti keeps the record. It does not lend, hold, move, collect or guarantee money, and it is not a bank, a payment service, a credit bureau or a debt collector. Any payment happens between you and the other person, outside treeti.</p>
  <h2>Who can use it</h2>
  <p>You must be at least 18, use your own email address, and give your real name, because your name appears on the records you approve.</p>
  <h2>Your agreements</h2>
  <ul>
    <li>What you enter should be true, and you should only invite people who are part of the agreement and expecting the invitation.</li>
    <li>Agreements recorded in treeti are interest-free. treeti does not add interest or fees to them.</li>
    <li>When the lender, the borrower and any requested witnesses have confirmed, that exact version is preserved. A change needs a new version that the parties approve again.</li>
    <li>A witness confirms that they have read the terms. A witness does not guarantee repayment.</li>
    <li>Repayments are recorded by one party and confirmed by the other. treeti cannot verify that money actually moved.</li>
  </ul>
  <h2>What treeti does not promise</h2>
  <p>treeti does not give legal, financial or religious advice. We do not promise that an agreement recorded here is legally enforceable, or that it meets the requirements of any law or religious ruling. If that matters for your agreement, ask someone qualified.</p>
  <p>Notifications, reminders and sign-in emails are provided on a best-effort basis and may be late or fail to arrive. treeti is a new service: it is provided as it is, may change, and may sometimes be unavailable. Keep your own copy of any record that is important to you.</p>
  <h2>Fair use</h2>
  <p>Do not use treeti to deceive, pressure or harass anyone, to record an agreement that is unlawful, to impersonate someone else, or to interfere with the service or other people’s records. We may suspend an account that does.</p>
  <h2>Disagreements between people</h2>
  <p>treeti is not a party to your agreements and does not settle disputes about them. To the extent the law allows, the operator is not responsible for losses that come from an agreement between users, from a payment made or not made, or from relying on a reminder.</p>
  <h2>Leaving</h2>
  <p>You can stop using treeti at any time and ask us to delete your account. Our <Link href="/privacy">privacy policy</Link> explains what is removed and what is kept for the other people in your agreements.</p>
  <h2>Changes and law</h2>
  <p>We may update these terms as treeti develops, and will change the date above when we do. These terms are governed by the laws of the Federal Republic of Nigeria.</p>
  <h2>Contact</h2>
  <p>Questions about these terms: <Email subject="treeti terms question"/>.</p>
</LegalPage>;}

export function Support(){return <LegalPage title="Help and support" lede="Something not working, or a question about your records? Here is how to reach us." dated={false}>
  <h2>Contact us</h2>
  <p>Email <Email subject="treeti support"/>. Tell us the email address on your account and what you were trying to do. If it is about an agreement, include its record number (it starts with TREETI). Please do not send passwords or sign-in codes.</p>
  <h2>Quick answers</h2>
  <ul>
    <li><strong>Someone has not seen their invitation.</strong> treeti does not email invitations; you send the private link yourself. Open the agreement, find the person under “Agreed together”, choose <strong>Resend invitation</strong> to get a fresh link, then share it on WhatsApp or copy it.</li><li><strong>Where do updates appear?</strong> Open <strong>Notifications</strong> (the bell) to see what other people have done on your agreements. The only email treeti sends you is your sign-in code.</li>
    <li><strong>My sign-in code did not arrive.</strong> Check your spam folder, wait a minute, then ask for a new code. Codes are sent only to the email address you typed.</li>
    <li><strong>I want to change an agreement.</strong> A confirmed agreement is preserved as it is. Create a new version from the agreement page; it takes effect once the parties approve it.</li>
    <li><strong>I want a copy of my information, or to delete my account.</strong> Email us from the address on your account. Our <Link href="/privacy">privacy policy</Link> explains what happens.</li>
  </ul>
  <h2>How treeti works</h2>
  <p>The <Link href="/guide">guide</Link> walks through agreements, repayments, private debts and investments.</p>
</LegalPage>;}
