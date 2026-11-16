/* eslint-disable jsx-a11y/alt-text -- Image here is a react-pdf QR primitive, not an HTML image. The verification address is printed beside it. */
import React from 'react';
import {Text,View,Image,Svg,Path,Circle,StyleSheet} from '@react-pdf/renderer';

/*
  One visual system for every treeti document (loan agreement, receipt, settlement record,
  investment agreement). Print-first: white paper, no full-bleed colour, one accent, a small
  type scale, numbered sections, right-aligned figures and a footer on every page.
*/
export const ink='#1a1720',muted='#67616b',faint='#e5dfd5',accent='#5a2db0',accentSoft='#f3eefb',ok='#1f6b4a',okSoft='#e9f4ee',caution='#7a4b00',cautionSoft='#fdf3e1';
export const pageWidth=595.28,margin=52,contentWidth=pageWidth-margin*2;

export const k=StyleSheet.create({
  page:{paddingTop:44,paddingBottom:70,paddingHorizontal:margin,fontFamily:'treeti Sans',fontSize:10,color:ink,backgroundColor:'#ffffff'},
  masthead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingBottom:14,borderBottomWidth:1,borderColor:ink,marginBottom:24},
  brand:{fontSize:19,fontWeight:700,lineHeight:1},dot:{color:accent},
  mastRight:{alignItems:'flex-end'},mastKind:{fontSize:7.5,fontWeight:700,letterSpacing:1.2,color:ink,lineHeight:1.3},mastRef:{fontSize:8,color:muted,marginTop:2,lineHeight:1.3},
  overline:{fontSize:7.5,fontWeight:700,letterSpacing:1.2,color:accent,marginBottom:8,lineHeight:1.3},
  title:{fontSize:27,fontWeight:700,lineHeight:1.15,letterSpacing:-0.4,marginBottom:10,maxWidth:430},
  lede:{fontSize:12,lineHeight:1.5,color:muted,maxWidth:420,marginBottom:16},
  pill:{flexDirection:'row',alignItems:'center',alignSelf:'flex-start',gap:5,paddingVertical:4,paddingHorizontal:9,borderRadius:20,marginBottom:22},
  pillText:{fontSize:8,fontWeight:700,lineHeight:1.2},
  hero:{backgroundColor:accentSoft,borderRadius:10,paddingVertical:18,paddingHorizontal:22},
  label:{fontSize:7.5,fontWeight:700,letterSpacing:0.8,color:muted,marginBottom:4,lineHeight:1.3},
  amount:{fontSize:32,fontWeight:700,lineHeight:1.1,letterSpacing:-0.6},
  amountNote:{fontSize:9,color:muted,marginTop:6},
  facts:{flexDirection:'row',marginTop:16,paddingTop:12,borderTopWidth:1,borderColor:'#ddd3ee'},
  fact:{flex:1,paddingRight:10},factValue:{fontSize:10,fontWeight:700,lineHeight:1.35},
  parties:{flexDirection:'row',gap:12,marginTop:12},
  party:{flex:1,borderWidth:1,borderColor:faint,borderRadius:10,paddingVertical:14,paddingHorizontal:16},
  partyName:{fontSize:13,fontWeight:700,lineHeight:1.3,marginBottom:6},
  signedLine:{flexDirection:'row',alignItems:'center',gap:4},signedText:{fontSize:8,color:muted,lineHeight:1.3},
  sectionHead:{flexDirection:'row',alignItems:'center',marginTop:26,marginBottom:12,paddingBottom:7,borderBottomWidth:1,borderColor:faint},
  sectionNumber:{fontSize:9,fontWeight:700,color:accent,width:22,lineHeight:1.3},
  sectionTitle:{fontSize:13,fontWeight:700,lineHeight:1.3},
  body:{fontSize:10.5,lineHeight:1.65,maxWidth:410},
  small:{fontSize:8.5,lineHeight:1.55,color:muted},
  tableHead:{flexDirection:'row',paddingBottom:6,borderBottomWidth:1,borderColor:ink},
  th:{fontSize:7.5,fontWeight:700,letterSpacing:0.8,color:muted,lineHeight:1.3},
  tr:{flexDirection:'row',paddingVertical:7,borderBottomWidth:1,borderColor:faint},
  td:{fontSize:10,lineHeight:1.4},
  total:{flexDirection:'row',paddingTop:9},totalText:{fontSize:10.5,fontWeight:700,lineHeight:1.4},
  sigRow:{flexDirection:'row',gap:18,marginBottom:16},
  sig:{flex:1},
  sigName:{fontSize:16,fontWeight:700,lineHeight:1.25,color:ink,paddingBottom:6,borderBottomWidth:1,borderColor:ink,marginTop:2},
  sigMeta:{flexDirection:'row',alignItems:'center',gap:4,marginTop:6,marginBottom:6},
  check:{marginTop:14,flexDirection:'row',borderWidth:1,borderColor:faint,borderRadius:10,paddingVertical:12,paddingHorizontal:14,gap:14,alignItems:'center'},
  qr:{width:66,height:66},
  hashLabel:{fontSize:6.5,fontWeight:700,letterSpacing:0.6,color:muted,marginTop:4,lineHeight:1.3},
  hash:{fontFamily:'Courier',fontSize:7.2,lineHeight:1.35,color:ink},
  note:{fontSize:7.5,lineHeight:1.55,color:muted,marginTop:12},
  demo:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:cautionSoft,borderRadius:8,paddingVertical:7,paddingHorizontal:12,marginBottom:20},
  demoText:{fontSize:8.5,color:caution,lineHeight:1.4,flex:1},
  // react-pdf drops render-prop text (page numbers) when the page sets lineHeight or the box is sized,
  // so the page has no lineHeight; every text style sets its own.
  pageNumber:{position:'absolute',bottom:33,right:margin,fontSize:7.5,color:muted},
  footer:{position:'absolute',bottom:28,left:margin,width:contentWidth,height:22,flexDirection:'row',paddingTop:8,borderTopWidth:1,borderColor:faint,fontSize:7.5,color:muted,lineHeight:1.3},
});

const dateFormat=new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',day:'numeric',month:'short',year:'numeric'});
const timeFormat=new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',hour:'2-digit',minute:'2-digit',hour12:false});
export function date(value:string){return dateFormat.format(new Date(value.length===10?`${value}T12:00:00Z`:value));}
export function stamp(value:string){const d=new Date(value);return `${dateFormat.format(d)}, ${timeFormat.format(d)} UTC`;}
export function signedVia(level:string){
  if(level==='DEMO_SESSION'||level==='DEMO_SIMULATED')return 'Demonstration sign-in';
  if(level.startsWith('VERIFIED_EMAIL'))return 'Email code checked';
  if(level.startsWith('VERIFIED_PHONE'))return 'Phone code checked';
  const words=level.replaceAll('_',' ').toLowerCase();return words.charAt(0).toUpperCase()+words.slice(1);
}
export function pairs<T>(items:T[]):T[][]{const out:T[][]=[];for(let i=0;i<items.length;i+=2)out.push(items.slice(i,i+2));return out;}

export function Tick({size=9,color=ok}:{size?:number;color?:string}){
  return <Svg width={size} height={size} viewBox="0 0 16 16"><Circle cx="8" cy="8" r="8" fill={color}/><Path d="M4.6 8.3l2.2 2.2 4.6-4.8" stroke="#ffffff" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round"/></Svg>;
}

export function Masthead({kind,reference}:{kind:string;reference:string}){
  return <View style={k.masthead} wrap={false}>
    <Text style={k.brand}>treeti<Text style={k.dot}>.</Text></Text>
    <View style={k.mastRight}><Text style={k.mastKind}>{kind.toUpperCase()}</Text><Text style={k.mastRef}>{reference}</Text></View>
  </View>;
}

export function DemoBanner({show}:{show:boolean}){
  if(!show)return null;
  return <View style={k.demo} wrap={false}><Text style={k.demoText}>Demonstration record with sample people. No real identity checks or payments took place.</Text></View>;
}

export function StatusPill({children,tone='ok'}:{children:string;tone?:'ok'|'accent'}){
  const color=tone==='ok'?ok:accent,bg=tone==='ok'?okSoft:accentSoft;
  return <View style={[k.pill,{backgroundColor:bg}]} wrap={false}><Tick size={9} color={color}/><Text style={[k.pillText,{color}]}>{children}</Text></View>;
}

export function Section({number,title,ahead=90,children}:{number:number;title:string;ahead?:number;children:React.ReactNode}){
  return <><View style={k.sectionHead} minPresenceAhead={ahead} wrap={false}><Text style={k.sectionNumber}>{String(number).padStart(2,'0')}</Text><Text style={k.sectionTitle}>{title}</Text></View>{children}</>;
}

export function Facts({items}:{items:[string,string][]}){
  return <View style={k.facts}>{items.map(([label,value])=><View key={label} style={k.fact}><Text style={k.label}>{label.toUpperCase()}</Text><Text style={k.factValue}>{value}</Text></View>)}</View>;
}

export type Column={label:string;width:number;align?:'left'|'right'};
export function Table({columns,rows,total,head=true}:{columns:Column[];rows:string[][];total?:string[];head?:boolean}){
  const cell=(c:Column)=>({width:`${c.width}%`,textAlign:c.align??'left'} as const);
  const row=(values:string[],i:number)=><View key={i} style={k.tr} wrap={false}>{values.map((value,j)=><Text key={j} style={[k.td,cell(columns[j]),j===0?{color:muted}:{},columns[j].align==='right'?{fontWeight:700}:{}]}>{value}</Text>)}</View>;
  const last=total?rows.length-1:rows.length;
  return <View>
    {head&&<View style={k.tableHead} wrap={false} fixed>{columns.map(c=><Text key={c.label} style={[k.th,cell(c)]}>{c.label.toUpperCase()}</Text>)}</View>}
    {rows.slice(0,last).map(row)}
    {/* The last row travels with the total, so a total never lands alone on a new page. */}
    {total&&<View wrap={false}>{rows.slice(last).map((r,i)=>row(r,last+i))}<View style={k.total}>{total.map((value,j)=><Text key={j} style={[k.totalText,cell(columns[j])]}>{value}</Text>)}</View></View>}
  </View>;
}

export type Signer={key:string;role:string;name:string;when:string;via:string;statement:string;extra?:string};
export function Signatures({signers}:{signers:Signer[]}){
  return <>{pairs(signers).map(row=><View key={row.map(s=>s.key).join()} style={k.sigRow} wrap={false}>
    {row.map(s=><View key={s.key} style={k.sig}>
      <Text style={k.label}>{s.role.toUpperCase()}</Text>
      <Text style={k.sigName}>{s.name}</Text>
      <View style={k.sigMeta}><Tick size={8}/><Text style={k.signedText}>Signed {s.when} · {s.via}</Text></View>
      <Text style={k.small}>{s.statement}</Text>
      {s.extra&&<Text style={[k.small,{marginTop:4}]}>{s.extra}</Text>}
    </View>)}
    {row.length===1&&<View style={k.sig}/>}
  </View>)}</>;
}

export function RecordCheck({qr,url,hashes,note}:{qr?:string;url?:string;hashes:[string,string][];note:string}){
  return <View wrap={false}>
    <View style={k.check}>
      {qr&&<Image src={qr} style={k.qr}/>}
      <View style={{flex:1}}>
        <Text style={{fontSize:10,fontWeight:700,lineHeight:1.35}}>Check this record</Text>
        <Text style={[k.small,{marginBottom:3}]}>{url?`Scan the code or visit ${url}`:'SHA-256 fingerprints of the signed record'}</Text>
        {hashes.map(([label,value])=><View key={label} style={{flexDirection:'row',alignItems:'baseline',marginTop:3}}><Text style={[k.hashLabel,{width:58,marginTop:0}]}>{label.toUpperCase()}</Text><Text style={k.hash}>{value}</Text></View>)}
      </View>
    </View>
    <Text style={k.note}>The fingerprints change if anything in the record changes. {note}</Text>
  </View>;
}

export function Footer({reference,demo}:{reference:string;demo:boolean}){
  return <>
    <View style={k.footer} fixed><Text>treeti · {reference}{demo?' · Demonstration record':''}</Text></View>
    <Text style={k.pageNumber} fixed render={({pageNumber,totalPages})=>`Page ${pageNumber} of ${totalPages}`}/>
  </>;
}
