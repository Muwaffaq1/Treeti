import React from 'react';
import {Document,Page,Text,View} from '@react-pdf/renderer';
import type {Aggregate,Manifest} from '@/modules/agreements/types';
import {money} from '@/lib/money';
import {repaymentLabel} from '@/modules/agreements/repayment-plan';
import {DemoBanner,Facts,Footer,Masthead,RecordCheck,Section,Signatures,StatusPill,Table,Tick,date,k,signedVia,stamp,type Signer} from './kit';

function lede(lender:string,borrower:string,m:Manifest){
  const t=m.version.terms,amount=money(t.principalMinor,t.currency);
  const plan=t.repaymentType==='SINGLE'||!t.installments?`in full by ${date(t.dueDate)}`:`in ${t.installments.payments.length} ${repaymentLabel(t).toLowerCase().replace('custom installments','installments')}, the last by ${date(t.dueDate)}`;
  return `${lender} lends ${borrower} ${amount}. It is to be repaid ${plan}, with no interest, fees or extra charges.`;
}

export function FinalAgreement({agreement:a,manifest:m,demo,qr,verifyUrl}:{agreement:Aggregate;manifest:Manifest;demo:boolean;qr:string;verifyUrl:string}){
  const v=m.version,t=v.terms,reference=`${a.publicId} · Version ${v.number}`;
  const person=(role:'LENDER'|'BORROWER')=>m.participants.find(p=>p.role===role)!;
  const approval=(role:'LENDER'|'BORROWER')=>m.approvals.find(p=>p.role===role);
  const signers:Signer[]=[
    ...[...m.approvals].sort((x,y)=>x.role===y.role?0:x.role==='LENDER'?-1:1).map(p=>({key:p.id,role:p.role==='LENDER'?'Lender':'Borrower',name:p.signature,when:stamp(p.createdAt),via:signedVia(p.authenticationLevel),statement:p.affirmation})),
    ...m.attestations.map(w=>({key:w.id,role:w.type==='DIGITAL_ACKNOWLEDGEMENT'?'Witness':`Witness · ${w.presence.replaceAll('_',' ').toLowerCase()}`,name:w.signature,when:stamp(w.createdAt),via:signedVia(w.authenticationLevel),statement:w.text})),
  ];
  let n=0;
  return <Document title={`${a.publicId} - Interest-free loan agreement`} author="treeti" creator="treeti" creationDate={new Date(m.finalizedAt)} modificationDate={new Date(m.finalizedAt)}>
    <Page size="A4" style={k.page}>
      <Masthead kind="Loan agreement" reference={reference}/>
      <DemoBanner show={demo}/>
      <Text style={k.overline}>INTEREST-FREE LOAN</Text>
      <Text style={k.title}>Loan agreement</Text>
      <Text style={k.lede}>{lede(person('LENDER').name,person('BORROWER').name,m)}</Text>
      <StatusPill>{`Signed by everyone · Finalized ${date(m.finalizedAt)}`}</StatusPill>

      <View style={k.hero} wrap={false}>
        <Text style={k.label}>{`AMOUNT LENT · ${t.currency}`}</Text>
        <Text style={k.amount}>{money(t.principalMinor,t.currency)}</Text>
        <Facts items={[['Interest',`None · ${money('0',t.currency)}`],['Repayment',repaymentLabel(t)],['Agreed on',date(t.agreementDate)],['Final due date',date(t.dueDate)]]}/>
      </View>
      <View style={k.parties} wrap={false}>{(['LENDER','BORROWER'] as const).map(role=>{const p=approval(role);return <View key={role} style={k.party}>
        <Text style={k.label}>{role}</Text><Text style={k.partyName}>{person(role).name}</Text>
        {p&&<View style={k.signedLine}><Tick size={8}/><Text style={k.signedText}>Signed {stamp(p.createdAt)}</Text></View>}
      </View>;})}</View>

      {t.installments&&<Section number={++n} title="Repayment schedule" ahead={110}>
        <Table columns={[{label:'Payment',width:20},{label:'Due date',width:45},{label:'Amount',width:35,align:'right'}]}
          rows={t.installments.payments.map((p,i)=>[String(i+1),date(p.dueDate),money(p.amountMinor,t.currency)])}
          total={['Total','',money(t.principalMinor,t.currency)]}/>
      </Section>}

      <Section number={++n} title="What was agreed" ahead={160}><Text style={k.body}>{v.text}</Text></Section>

      <Section number={++n} title="Signatures" ahead={150}>
        <Signatures signers={signers}/>
        {!m.attestations.length&&<Text style={k.small}>No witnesses were requested for this agreement.</Text>}
      </Section>

      <RecordCheck qr={qr} url={verifyUrl} hashes={[['Version',v.hash],['Evidence',m.hash],['Audit root',m.auditRoot]]} note={`Finalized ${stamp(m.finalizedAt)}. ${demo?'This synthetic record demonstrates the treeti workflow. No real identity verification or external payment occurred. ':''}treeti preserves participant actions and a structured record. Hash consistency is not an external cryptographic signature. This record does not assert legal enforceability or Islamic compliance.`}/>
      <Footer reference={reference} demo={demo}/>
    </Page>
  </Document>;
}
