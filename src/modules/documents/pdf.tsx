import React from 'react';
import { Document, Page, Text, View, Font, renderToBuffer } from '@react-pdf/renderer';
import { font400, font700 } from './fonts.generated';
import QRCode from 'qrcode';
import type { Aggregate, Manifest } from '@/modules/agreements/types';
import { money } from '@/lib/money';
import {FinalAgreement} from './final-agreement';
import {DemoBanner,Facts,Footer,Masthead,RecordCheck,Section,Signatures,StatusPill,Table,accent,date,faint,k,signedVia,stamp,type Signer} from './kit';

Font.register({family:'treeti Sans',fonts:[{src:font400},{src:font700,fontWeight:700}]});
Font.registerHyphenationCallback(word=>[word]);
type Kind='pdf'|'settlement'|'receipt';

const disclaimer=(demo:boolean)=>`${demo?'This synthetic record demonstrates the treeti workflow. No real identity verification or external payment occurred. ':''}treeti preserves participant actions and a structured record. Hash consistency is not an external cryptographic signature. This record does not assert legal enforceability or Islamic compliance.`;

function Progress({settledMinor,principalMinor}:{settledMinor:bigint;principalMinor:bigint}){
  const share=principalMinor>0n?Number(settledMinor*1000n/principalMinor)/10:0;
  return <View style={{height:6,borderRadius:3,backgroundColor:faint,marginBottom:12}}><View style={{width:`${Math.min(100,share)}%`,height:6,borderRadius:3,backgroundColor:accent}}/></View>;
}

function Receipt({a,manifest:m,paymentId,qr,verifyUrl,demo}:{a:Aggregate;manifest:Manifest;paymentId:string;qr:string;verifyUrl:string;demo:boolean}){
  const v=m.version,t=v.terms,payment=a.repayments.find(r=>r.id===paymentId&&r.status==='CONFIRMED')!,reference=`${a.publicId} · Version ${v.number}`;
  const confirmedAt=a.repaymentConfirmations.find(c=>c.repaymentId===paymentId)?.createdAt??m.finalizedAt;
  const payer=a.participants.find(p=>p.id===payment.participantId),payee=m.participants.find(p=>p.role!=='WITNESS'&&p.id!==payment.participantId);
  const principal=BigInt(t.principalMinor),remaining=BigInt(receiptBalance(a,paymentId)),settled=principal-remaining;
  return <Document title={`${a.publicId} — Repayment receipt`} author="treeti" creator="treeti" creationDate={new Date(confirmedAt)} modificationDate={new Date(confirmedAt)}>
    <Page size="A4" style={k.page}>
      <Masthead kind="Repayment receipt" reference={reference}/>
      <DemoBanner show={demo}/>
      <Text style={k.overline}>PAYMENT CONFIRMED</Text>
      <Text style={k.title}>Repayment receipt</Text>
      <Text style={k.lede}>{payer?.name??'The borrower'} paid {payee?.name??'the lender'} {money(payment.amountMinor,t.currency)} on {date(payment.date)}. Both confirmed it.</Text>
      <StatusPill>{`Confirmed by both · ${stamp(confirmedAt)}`}</StatusPill>
      <View style={k.hero} wrap={false}>
        <Text style={k.label}>{`AMOUNT PAID · ${t.currency}`}</Text>
        <Text style={k.amount}>{money(payment.amountMinor,t.currency)}</Text>
        <Facts items={[['Paid on',date(payment.date)],['Method',payment.method],['Reference',payment.reference||'None given'],['Confirmed',date(confirmedAt)]]}/>
      </View>
      <Section number={1} title="Balance after this payment" ahead={120}>
        <Progress settledMinor={settled} principalMinor={principal}/>
        <Table head={false} columns={[{label:'Balance',width:60},{label:'Amount',width:40,align:'right'}]} rows={[['Amount lent',money(t.principalMinor,t.currency)],['Settled so far',money(settled.toString(),t.currency)]]} total={['Still to repay',money(remaining.toString(),t.currency)]}/>
      </Section>
      <RecordCheck qr={qr} url={verifyUrl} hashes={[['Version',v.hash],['Evidence',m.hash],['Audit root',m.auditRoot]]} note={`treeti did not transfer or receive these funds. Only payments both people confirm change the balance. ${disclaimer(demo)}`}/>
      <Footer reference={reference} demo={demo}/>
    </Page>
  </Document>;
}

function Settlement({a,manifest:m,qr,verifyUrl,demo}:{a:Aggregate;manifest:Manifest;qr:string;verifyUrl:string;demo:boolean}){
  const v=m.version,t=v.terms,reference=`${a.publicId} · Version ${v.number}`,settledAt=a.settledAt!;
  const name=(role:'LENDER'|'BORROWER')=>m.participants.find(p=>p.role===role)!.name;
  const confirmed=a.repayments.filter(r=>r.status==='CONFIRMED');
  const forgiven=a.adjustments.filter(x=>a.adjustmentConfirmations.some(c=>c.adjustmentId===x.id));
  const rows=[...confirmed.map(r=>[date(r.date),r.method,money(r.amountMinor,t.currency)]),...forgiven.map(x=>['—','Forgiven',money(x.amountMinor,t.currency)])];
  const signers:Signer[]=a.settlements.map(s=>{const p=a.participants.find(p=>p.id===s.participantId)!;return {key:s.id,role:p.role==='LENDER'?'Lender':p.role==='BORROWER'?'Borrower':'Participant',name:p.name,when:stamp(s.createdAt),via:signedVia(s.authenticationLevel),statement:s.affirmation,extra:s.affirmedAt?`Agreed in advance on ${stamp(s.affirmedAt)}; took effect when the final payment was confirmed.`:undefined};});
  return <Document title={`${a.publicId} — Debt settlement record`} author="treeti" creator="treeti" creationDate={new Date(settledAt)} modificationDate={new Date(settledAt)}>
    <Page size="A4" style={k.page}>
      <Masthead kind="Settlement record" reference={reference}/>
      <DemoBanner show={demo}/>
      <Text style={k.overline}>SETTLED IN FULL</Text>
      <Text style={k.title}>Settlement record</Text>
      <Text style={k.lede}>{name('LENDER')} and {name('BORROWER')} have both confirmed that this {money(t.principalMinor,t.currency)} loan is fully settled. Nothing more is owed.</Text>
      <StatusPill>{`Settled · ${stamp(settledAt)}`}</StatusPill>
      <View style={k.hero} wrap={false}>
        <Text style={k.label}>{`AMOUNT LENT · ${t.currency}`}</Text>
        <Text style={k.amount}>{money(t.principalMinor,t.currency)}</Text>
        <Facts items={[['Still owed',money('0',t.currency)],['Settled on',date(settledAt)],['Settled by',forgiven.length?'Repayment and forgiveness':'Full repayment'],['Agreed on',date(t.agreementDate)]]}/>
      </View>
      <Section number={1} title="How it was settled" ahead={110}>
        <Table columns={[{label:'Date',width:30},{label:'How',width:40},{label:'Amount',width:30,align:'right'}]} rows={rows} total={['Total','',money(t.principalMinor,t.currency)]}/>
      </Section>
      <Section number={2} title="Confirmations" ahead={150}><Signatures signers={signers}/></Section>
      <RecordCheck qr={qr} url={verifyUrl} hashes={[['Version',v.hash],['Evidence',m.hash],['Audit root',m.auditRoot]]} note={disclaimer(demo)}/>
      <Footer reference={reference} demo={demo}/>
    </Page>
  </Document>;
}

function AgreementPDF({a,manifest,kind,paymentId,qr,verifyUrl,demo}:{a:Aggregate;manifest:Manifest;kind:Kind;paymentId?:string|null;qr:string;verifyUrl:string;demo:boolean}){
  if(kind==='pdf')return <FinalAgreement agreement={a} manifest={manifest} demo={demo} qr={qr} verifyUrl={verifyUrl}/>;
  if(kind==='receipt')return <Receipt a={a} manifest={manifest} paymentId={paymentId!} qr={qr} verifyUrl={verifyUrl} demo={demo}/>;
  return <Settlement a={a} manifest={manifest} qr={qr} verifyUrl={verifyUrl} demo={demo}/>;
}
export function receiptBalance(a:Aggregate,paymentId:string):string{
  const target=a.repaymentConfirmations.find(c=>c.repaymentId===paymentId&&c.action==='CONFIRMED');if(!target)throw new Error('Payment is not confirmed.');
  const event=a.events.find(e=>e.type==='REPAYMENT_CONFIRMED'&&e.payload.repaymentId===paymentId)!;
  const prior=a.events.filter(e=>e.sequence<=event.sequence);
  const payments=new Set(prior.filter(e=>e.type==='REPAYMENT_CONFIRMED').map(e=>e.payload.repaymentId));
  const adjustments=new Set(prior.filter(e=>e.type==='FORGIVENESS_CONFIRMED').map(e=>e.payload.adjustmentId));
  return (BigInt(a.manifest!.version.terms.principalMinor)-a.repayments.filter(r=>payments.has(r.id)).reduce((s,r)=>s+BigInt(r.amountMinor),0n)-a.adjustments.filter(r=>adjustments.has(r.id)).reduce((s,r)=>s+BigInt(r.amountMinor),0n)).toString();
}
export function verifyAddress(publicId:string,demo:boolean){return `${process.env.AHD_APP_URL||'http://localhost:3000'}/${demo?'demo/':''}verify/${publicId}`;}
export async function qrFor(url:string){return QRCode.toDataURL(url,{margin:0,width:240,color:{dark:'#1a1720',light:'#ffffff'}});}
export async function renderAgreement(a:Aggregate,kind:Kind='pdf',paymentId?:string|null,demo=false){
  if(!a.manifest)throw new Error('No finalized snapshot.');
  const verifyUrl=verifyAddress(a.publicId,demo),qr=await qrFor(verifyUrl);
  return renderToBuffer(<AgreementPDF a={a} manifest={a.manifest} kind={kind} paymentId={paymentId} qr={qr} verifyUrl={verifyUrl} demo={demo}/>);
}
