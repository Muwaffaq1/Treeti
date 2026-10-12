import { active,act,approved,input,terms,people,now } from '../helpers';
import {createAgreement} from '../../src/modules/agreements/domain';
import {recurringPlan} from '../../src/modules/agreements/repayment-plan';
import { renderAgreement } from '../../src/modules/documents/pdf';
import { digest, sha256 } from '../../src/lib/crypto';
import { encryptDelivery, decryptDelivery, readSession, signSession } from '../../src/lib/session';
import {createInvestment,changeInvestment,investmentTotal,investmentTotals} from '../../src/modules/investments/model';

// Synthetic local-only runtime probe. Never included in the application's Worker.
const probe = {
  async fetch(request: Request) {
    const path=new URL(request.url).pathname;
    if(path==='/investments'){
      const record=createInvestment({name:'Synthetic business',currency:'GBP',amountMinor:'130001',date:'2026-10-01'},people[0].userId,'record','11111111-1111-4111-8111-111111111111',now);
      const next=changeInvestment(record,{action:'contribute',amountMinor:'25025',date:'2026-10-08',expectedRevision:0},people[0].userId,'22222222-2222-4222-8222-222222222222',now);
      return Response.json({currency:next.currency,total:investmentTotal(next),totals:investmentTotals([next])});
    }
    if (path === '/pdf' || path === '/installments-pdf') {
      const a=path==='/pdf'?active():act(approved(0,createAgreement({...input,terms:{...terms,requiredWitnesses:0,principalMinor:'100001',dueDate:'2027-03-31',repaymentType:'INSTALLMENTS',installments:recurringPlan('100001','2027-01-31',3,'MONTHLY')}},{actor:people[0],now},'TREETI-2026-RUNTIME')) ,people[0],'finalize').agreement;
      const bytes = await renderAgreement(a, 'pdf', undefined, true);
      return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'application/pdf', 'X-Ahd-Document-Hash': sha256(bytes) } });
    }
    const value = { synthetic: true, version: 1 }, encrypted = encryptDelivery(value);
    return Response.json({ session: readSession(signSession(value)), delivery: decryptDelivery(encrypted), hash: digest(value) });
  },
};
export default probe;
