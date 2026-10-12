import React from 'react';
import {Document,Page,Text,View,StyleSheet} from '@react-pdf/renderer';
import type {Aggregate,Manifest} from '@/modules/agreements/types';
import {money} from '@/lib/money';
import {repaymentLabel} from '@/modules/agreements/repayment-plan';

const s=StyleSheet.create({
  page:{padding:44,paddingBottom:44,fontFamily:'treeti Sans',fontSize:10,lineHeight:1.6,color:'#29262c',backgroundColor:'#faf6ed'},
  masthead:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',marginBottom:27},
  brand:{fontSize:30,fontWeight:700,lineHeight:1.1},dot:{color:'#8051c9'},tagline:{fontSize:8,color:'#726d78',marginTop:7},
  reference:{textAlign:'right',fontSize:8,color:'#726d78',maxWidth:220,lineHeight:1.7},
  title:{fontSize:24,fontWeight:700,lineHeight:1.25,marginBottom:23,maxWidth:380},
  parties:{flexDirection:'row',gap:24,borderTopWidth:1,borderBottomWidth:1,borderColor:'#ded7cc',paddingVertical:15,marginBottom:23},
  party:{flex:1},label:{fontSize:8,color:'#726d78',marginBottom:5},partyName:{fontSize:13,fontWeight:700,lineHeight:1.4},
  amountPanel:{backgroundColor:'#f0e9f8',borderRadius:8,padding:20,marginBottom:22},
  amount:{fontSize:29,fontWeight:700,lineHeight:1.2,marginTop:4,marginBottom:13},
  amountDetails:{flexDirection:'row',gap:22},detail:{flex:1},detailValue:{fontSize:10,fontWeight:700},
  facts:{flexDirection:'row',gap:20,marginBottom:7},
  section:{fontSize:13,fontWeight:700,lineHeight:1.3,marginTop:23,marginBottom:11},
  row:{flexDirection:'row',justifyContent:'space-between',borderBottomWidth:1,borderColor:'#ded7cc',paddingVertical:8},
  rowLabel:{color:'#726d78',width:'60%'},rowAmount:{width:'40%',textAlign:'right',fontWeight:700},
  paragraph:{fontSize:10},confirmation:{paddingVertical:13,borderTopWidth:1,borderColor:'#ded7cc'},
  signature:{fontSize:13,fontWeight:700,marginBottom:7,lineHeight:1.4},
  confirmationLabel:{fontSize:8,color:'#8051c9',marginBottom:5},
  evidence:{fontSize:8,color:'#726d78',marginTop:9,lineHeight:1.6},
});
function date(value:string){return new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',day:'numeric',month:'short',year:'numeric'}).format(new Date(value.length===10?`${value}T12:00:00Z`:value));}
function timestamp(value:string){return `${new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value))} UTC`;}
export function FinalAgreement({agreement:a,manifest:m,demo}:{agreement:Aggregate;manifest:Manifest;demo:boolean}){
  const v=m.version,t=v.terms;
  return <Document title={`${a.publicId} - Interest-free loan agreement`} author="treeti" creator="treeti" creationDate={new Date(m.finalizedAt)} modificationDate={new Date(m.finalizedAt)}>
    <Page size="A4" style={s.page}>
      <View style={s.masthead} wrap={false}><View><Text style={s.brand}>treeti<Text style={s.dot}>.</Text></Text><Text style={s.tagline}>Clarity today. Trust tomorrow.</Text></View><View style={s.reference}><Text>{a.publicId}</Text><Text>Version {v.number} - Finalized</Text>{demo&&<Text>DEMONSTRATION RECORD</Text>}</View></View>
      <Text style={s.title}>Interest-free loan agreement</Text>
      <View style={s.parties} wrap={false}>{(['LENDER','BORROWER'] as const).map(role=><View key={role} style={s.party}><Text style={s.label}>{role==='LENDER'?'Lender':'Borrower'}</Text><Text style={s.partyName}>{m.participants.find(p=>p.role===role)!.name}</Text></View>)}</View>
      <View style={s.amountPanel} wrap={false}><Text style={s.label}>Agreed principal - {t.currency}</Text><Text style={s.amount}>{money(t.principalMinor,t.currency)}</Text><View style={s.amountDetails}><View style={s.detail}><Text style={s.label}>Contractual interest</Text><Text style={s.detailValue}>{money('0',t.currency)} (0%)</Text></View><View style={s.detail}><Text style={s.label}>Repayment structure</Text><Text style={s.detailValue}>{repaymentLabel(t)}</Text></View></View></View>
      <View style={s.facts} wrap={false}><View style={s.detail}><Text style={s.label}>Agreement date</Text><Text>{date(t.agreementDate)}</Text></View><View style={s.detail}><Text style={s.label}>Final repayment date</Text><Text>{date(t.dueDate)}</Text></View></View>
      <Text style={s.evidence}>Finalized {timestamp(m.finalizedAt)}</Text>
      {t.installments&&<><Text style={s.section} minPresenceAhead={70}>Installment schedule</Text>{t.installments.payments.map((payment,i)=><View key={i} style={s.row} wrap={false}><Text style={s.rowLabel}>Payment {i+1} - {date(payment.dueDate)}</Text><Text style={s.rowAmount}>{money(payment.amountMinor,t.currency)}</Text></View>)}</>}
      <Text style={s.section} minPresenceAhead={180}>The agreed wording</Text><Text style={s.paragraph}>{v.text}</Text>
      <Text style={s.section} minPresenceAhead={120}>Party confirmations</Text>
      {m.approvals.map(p=><View key={p.id} style={s.confirmation} wrap={false}><Text style={s.confirmationLabel}>{p.role==='LENDER'?'Lender':'Borrower'} confirmation</Text><Text style={s.signature}>{p.signature}</Text><Text>{p.affirmation}</Text><Text style={s.evidence}>{timestamp(p.createdAt)}{`\n`}{p.authenticationLevel} - {p.affirmationVersion}</Text></View>)}
      <Text style={s.section} minPresenceAhead={m.attestations.length?120:40}>{v.payload.witnessPolicy==='DIGITAL_ACKNOWLEDGEMENT_V1'?'Witness acknowledgments':'Witness attestations'}</Text>
      {!m.attestations.length&&<Text>No witnesses were requested for this recorded workflow.</Text>}
      {m.attestations.map(w=><View key={w.id} style={s.confirmation} wrap={false}><Text style={s.confirmationLabel}>{w.type==='DIGITAL_ACKNOWLEDGEMENT'?'Digital witness acknowledgment':w.presence.replaceAll('_',' ')}</Text><Text style={s.signature}>{w.signature}</Text><Text>{w.text}</Text><Text style={s.evidence}>{timestamp(w.createdAt)}{`\n`}{w.authenticationLevel} - {w.textVersion}</Text></View>)}
    </Page>
  </Document>;
}
