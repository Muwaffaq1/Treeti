import React from 'react';
import {NextResponse} from 'next/server';
import {Document,Page,Text,View,renderToBuffer} from '@react-pdf/renderer';
import {sha256} from '@/lib/crypto';
import {money} from '@/lib/money';
import {DomainError} from '@/lib/domain-error';
import type {Actor} from '@/modules/agreements/types';
import '@/modules/documents/pdf';
import {DemoBanner,Facts,Footer,Masthead,RecordCheck,Section,Signatures,StatusPill,Table,date,k,signedVia,stamp,type Signer} from '@/modules/documents/kit';
import {isMember,latest,totalCapital,verifyEvents,type InvestmentAgreement} from './model';

// Same visual system as the loan agreement PDF (documents/kit.tsx).
const list=(names:string[])=>names.length<2?names.join(''):`${names.slice(0,-1).join(', ')} and ${names.at(-1)}`;
function InvestmentAgreementPDF({a,demo}:{a:InvestmentAgreement;demo:boolean}){
  const v=latest(a),t=v.terms,nameOf=(id:string)=>a.partners.find(p=>p.id===id)!.name,reference=`${a.publicId} · Version ${v.number}`;
  const signatures=a.signatures.filter(x=>x.versionId===v.id),attestations=a.attestations.filter(x=>x.versionId===v.id);
  const signers:Signer[]=[
    ...signatures.map(x=>({key:x.id,role:'Partner',name:x.signature,when:stamp(x.createdAt),via:signedVia(x.level),statement:x.affirmation})),
    ...attestations.map(x=>({key:x.id,role:'Witness',name:x.signature,when:stamp(x.createdAt),via:signedVia(x.level),statement:x.text})),
  ];
  const partners=v.stakes.length;
  return <Document title={`${a.publicId} - Investment agreement`} author="treeti" creator="treeti" creationDate={new Date(a.finalizedAt!)} modificationDate={new Date(a.finalizedAt!)}>
    <Page size="A4" style={k.page}>
      <Masthead kind="Investment agreement" reference={reference}/>
      <DemoBanner show={demo}/>
      <Text style={k.overline}>PARTNERSHIP</Text>
      <Text style={k.title}>{t.venture}</Text>
      <Text style={k.lede}>{list(v.stakes.map(st=>nameOf(st.partnerId)))} are investing together, putting in {money(totalCapital(v.stakes),t.currency)} between them.</Text>
      <StatusPill>{`Signed by every partner · Finalized ${date(a.finalizedAt!)}`}</StatusPill>
      <View style={k.hero} wrap={false}>
        <Text style={k.label}>{`TOTAL PUT IN · ${t.currency}`}</Text>
        <Text style={k.amount}>{money(totalCapital(v.stakes),t.currency)}</Text>
        <Facts items={[['Starts',date(t.startDate)],['Review',t.reviewDate?date(t.reviewDate):'Not set'],['Looked after by',t.manager??'All partners'],['Partners',String(partners)]]}/>
      </View>
      <Section number={1} title="Partners" ahead={120}>
        <Table columns={[{label:'Partner',width:60},{label:'Puts in',width:40,align:'right'}]}
          rows={v.stakes.map(st=>[nameOf(st.partnerId),money(st.capitalMinor,t.currency)])}
          total={['Total',money(totalCapital(v.stakes),t.currency)]}/>
      </Section>
      <Section number={2} title="What was agreed" ahead={160}><Text style={k.body}>{v.text}</Text></Section>
      <Section number={3} title="Signatures" ahead={150}>
        <Signatures signers={signers}/>
        {!attestations.length&&<Text style={k.small}>No witnesses signed this agreement.</Text>}
      </Section>
      <RecordCheck hashes={[['Version',v.hash],['Record',a.finalHash??'']]} note={`Finalized ${stamp(a.finalizedAt!)}. ${demo?'This synthetic record demonstrates the treeti workflow. No real identity verification or money movement occurred. ':''}treeti keeps this record. It does not hold, move or invest money. This record does not assert legal enforceability or Islamic compliance.`}/>
      <Footer reference={reference} demo={demo}/>
    </Page>
  </Document>;
}
export function renderInvestmentAgreement(a:InvestmentAgreement,demo:boolean){return renderToBuffer(<InvestmentAgreementPDF a={a} demo={demo}/>);}
export async function investmentAgreementResponse(a:InvestmentAgreement,actor:Actor,demo:boolean){
  if(!isMember(a,actor))throw new DomainError('NOT_FOUND','This agreement is unavailable.',404);
  if(a.status!=='ACTIVE')throw new DomainError('NOT_FINALIZED','The PDF is ready once everyone has signed.',409);
  if(!verifyEvents(a.events))throw new DomainError('INTEGRITY_FAILED','This record could not be verified. Contact treeti before relying on it.',503);
  const bytes=await renderInvestmentAgreement(a,demo);
  return new NextResponse(new Uint8Array(bytes),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${a.publicId}-investment-agreement.pdf"`,'Cache-Control':'private, no-store','X-Ahd-Document-Hash':sha256(bytes)}});
}
