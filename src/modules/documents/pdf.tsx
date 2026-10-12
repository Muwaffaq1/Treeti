/* eslint-disable jsx-a11y/alt-text -- This Image is a react-pdf QR primitive, not an HTML image. Its verification URL is printed as text. */
import React from 'react';
import { Document, Page, Text, View, Font, Image, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import { font400, font700 } from './fonts.generated';
import QRCode from 'qrcode';
import type { Aggregate, Manifest } from '@/modules/agreements/types';
import { money } from '@/lib/money';
import {FinalAgreement} from './final-agreement';

Font.register({family:'treeti Sans',fonts:[{src:font400},{src:font700,fontWeight:700}]});
Font.registerHyphenationCallback(word=>[word]);
const styles=StyleSheet.create({page:{paddingTop:45,paddingBottom:65,paddingHorizontal:44,fontFamily:'treeti Sans',fontSize:10,color:'#233b35',lineHeight:1.55},brand:{fontSize:28,fontWeight:700,lineHeight:1.3,marginBottom:8},eyebrow:{fontSize:9,color:'#586b64',marginBottom:22},title:{fontSize:21,fontWeight:700,lineHeight:1.3,marginBottom:18},section:{marginTop:18,marginBottom:8,fontSize:12,fontWeight:700,lineHeight:1.4},row:{flexDirection:'row',justifyContent:'space-between',paddingVertical:6,borderBottom:'1 solid #e5e8e3'},label:{color:'#586b64',width:'42%'},value:{width:'58%',textAlign:'right'},paragraph:{marginTop:8},hash:{fontSize:8,marginTop:7,color:'#586b64',lineHeight:1.5},footer:{position:'absolute',bottom:24,left:44,width:507,height:16,lineHeight:1.4,fontSize:8,color:'#586b64',flexDirection:'row',justifyContent:'space-between'},qr:{width:58,height:58,marginTop:12},note:{padding:12,backgroundColor:'#f5f5ee',fontSize:9,marginTop:20}});
type Kind='pdf'|'settlement'|'receipt';
const Row=({label,value}:{label:string;value:string})=><View style={styles.row} wrap={false}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>;
function AgreementPDF({a,manifest,kind,paymentId,qr,demo}:{a:Aggregate;manifest:Manifest;kind:Kind;paymentId?:string|null;qr:string;demo:boolean}){
  if(kind==='pdf')return <FinalAgreement agreement={a} manifest={manifest} demo={demo}/>;
  const v=manifest.version,t=v.terms,confirmed=a.repayments.filter(r=>r.status==='CONFIRMED'),payment=confirmed.find(r=>r.id===paymentId);
  const frozenTime=kind==='settlement'?a.settledAt!:kind==='receipt'?a.repaymentConfirmations.find(c=>c.repaymentId===paymentId)?.createdAt??manifest.finalizedAt:manifest.finalizedAt;
  return <Document title={`${a.publicId} — ${kind==='settlement'?'Debt settlement record':'Repayment receipt'}`} author="treeti" creator="treeti" creationDate={new Date(frozenTime)} modificationDate={new Date(frozenTime)}>
    <Page size="A4" style={styles.page}>
      <Text style={styles.brand}>treeti.</Text><Text style={styles.eyebrow}>CLARITY TODAY. TRUST TOMORROW.{demo?'  ·  DEMONSTRATION RECORD':''}</Text>
      <Text style={styles.title}>{kind==='settlement'?'Debt settlement record':'Repayment receipt'}</Text>
      <Row label="Agreement" value={a.publicId}/><Row label="Version" value={String(v.number)}/><Row label="Lender" value={manifest.participants.find(p=>p.role==='LENDER')!.name}/><Row label="Borrower" value={manifest.participants.find(p=>p.role==='BORROWER')!.name}/>
      {kind==='receipt'?<>
        <Row label="Confirmed payment" value={money(payment!.amountMinor,t.currency)}/><Row label="Payment date" value={payment!.date}/><Row label="Method" value={payment!.method}/><Row label="Reference" value={payment!.reference||'Not provided'}/><Row label="Confirmed at (UTC)" value={frozenTime}/>
        <Text style={styles.paragraph}>Both parties have recorded and confirmed this payment. treeti did not transfer or receive these funds.</Text>
        <Row label="Remaining after this confirmation" value={money(receiptBalance(a,paymentId!),t.currency)}/>
      </>:<>
        <Row label="Original principal" value={money(t.principalMinor,t.currency)}/><Row label="Remaining balance" value={money('0',t.currency)}/><Row label="Settled at (UTC)" value={a.settledAt!}/><Row label="Settlement basis" value={a.adjustmentConfirmations.length?'Repayment and/or acknowledged forgiveness':'Fully repaid'}/>
        <Text style={styles.section} minPresenceAhead={55}>Confirmed repayments</Text>{confirmed.map(r=><Row key={r.id} label={`${r.date} · ${r.method}`} value={money(r.amountMinor,t.currency)}/>)}
        {a.adjustments.filter(x=>a.adjustmentConfirmations.some(c=>c.adjustmentId===x.id)).map(x=><Row key={x.id} label="Acknowledged forgiveness" value={money(x.amountMinor,t.currency)}/>)}
        <Text style={styles.section} minPresenceAhead={55}>Settlement acknowledgments</Text>{a.settlements.map(s=><View key={s.id} style={styles.paragraph} wrap={false}><Text>{a.participants.find(p=>p.id===s.participantId)!.name}</Text><Text>{s.affirmation}</Text><Text style={styles.hash}>{s.createdAt} · {s.authenticationLevel}</Text>{s.affirmedAt&&<Text style={styles.hash}>Conditional consent recorded {s.affirmedAt}; took effect on confirmation of the final payment.</Text>}</View>)}
      </>}
      <Text style={styles.section} minPresenceAhead={55}>Record integrity</Text><Text style={styles.hash}>Version SHA-256: {v.hash}</Text><Text style={styles.hash}>Evidence manifest SHA-256: {manifest.hash}</Text><Text style={styles.hash}>Audit root: {manifest.auditRoot}</Text>
      <Image src={qr} style={styles.qr}/><Text style={styles.hash}>Verify: {process.env.AHD_APP_URL||'http://localhost:3000'}/{demo?'demo/':''}verify/{a.publicId}</Text>
      <Text style={styles.note}>{demo?'This synthetic record demonstrates the treeti workflow. No real identity verification or external payment occurred. ':' '}treeti preserves participant actions and a structured record. Hash consistency is not an external cryptographic signature. This record does not assert legal enforceability or Islamic compliance.</Text>
      <View fixed style={styles.footer}><Text style={{width:400}}>{a.publicId} · Version {v.number}</Text><Text style={{width:75,textAlign:'right'}} render={({pageNumber,totalPages})=>`${pageNumber} / ${totalPages}`}/></View>
    </Page>
  </Document>;
}
export function receiptBalance(a:Aggregate,paymentId:string):string{
  const target=a.repaymentConfirmations.find(c=>c.repaymentId===paymentId&&c.action==='CONFIRMED');if(!target)throw new Error('Payment is not confirmed.');
  const event=a.events.find(e=>e.type==='REPAYMENT_CONFIRMED'&&e.payload.repaymentId===paymentId)!;
  const prior=a.events.filter(e=>e.sequence<=event.sequence);
  const payments=new Set(prior.filter(e=>e.type==='REPAYMENT_CONFIRMED').map(e=>e.payload.repaymentId));
  const adjustments=new Set(prior.filter(e=>e.type==='FORGIVENESS_CONFIRMED').map(e=>e.payload.adjustmentId));
  return (BigInt(a.manifest!.version.terms.principalMinor)-a.repayments.filter(r=>payments.has(r.id)).reduce((s,r)=>s+BigInt(r.amountMinor),0n)-a.adjustments.filter(r=>adjustments.has(r.id)).reduce((s,r)=>s+BigInt(r.amountMinor),0n)).toString();
}
export async function renderAgreement(a:Aggregate,kind:Kind='pdf',paymentId?:string|null,demo=false){
  if(!a.manifest)throw new Error('No finalized snapshot.');
  const qr=kind==='pdf'?'':await QRCode.toDataURL(`${process.env.AHD_APP_URL||'http://localhost:3000'}/${demo?'demo/':''}verify/${a.publicId}`,{margin:1,width:180});
  return renderToBuffer(<AgreementPDF a={a} manifest={a.manifest} kind={kind} paymentId={paymentId} qr={qr} demo={demo}/>);
}
