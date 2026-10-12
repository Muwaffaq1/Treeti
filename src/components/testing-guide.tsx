import Link from 'next/link';

export function TestingGuide({demo}:{demo:boolean}){
  if(!demo)return null;
  return <section className="panel testing-guide" aria-labelledby="testing-guide-title">
    
    <h2 id="testing-guide-title">Try every role in one browser</h2>
    <p className="lede">The demonstration includes sample profiles and lets you switch into people you add to an invitation. Each invitation must be opened while you are viewing it as the invited person.</p>
    <ol className="testing-steps">
      <li><strong>Start as Abdullah Musa.</strong> Create an agreement for <em>Ahmad Ibrahim</em>, choose one or two witnesses, then select Agree and send.</li>
      <li><strong>Copy the borrower invitation.</strong> Open that link, switch the profile menu to Ahmad, read the terms, and approve or request changes.</li>
      <li><strong>Return to Abdullah.</strong> Open the same agreement from Agreements and invite the requested witnesses. Your agreement was recorded when you selected Agree and send.</li>
      <li><strong>Test each witness separately.</strong> Open each witness invitation first, switch to Maryam Bello or Yusuf Ali, then read the terms and confirm as a witness.</li>
      <li><strong>Check the preserved record.</strong> The record finalizes automatically after the requested witness acknowledgments. Download the agreement PDF and check its public integrity page.</li>
      <li><strong>Test repayment and settlement.</strong> Record a payment as either party, confirm or dispute it as the other party, For a final payment, each party can choose to close the agreement in that same action. Both must agree; separate settlement acknowledgments are also available.</li>
    </ol>
    <p className="quiet-note">The demonstration is synthetic: no real OTP, email, identity check, or payment is performed.</p>
    <Link className="button button-secondary" href="/demo/agreements/new">Start a fresh agreement</Link>
  </section>;
}
