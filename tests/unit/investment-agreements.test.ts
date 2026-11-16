import {describe,it,expect} from 'vitest';
import {mkdir,writeFile} from 'node:fs/promises';
import {renderInvestmentAgreement} from '@/modules/investment-agreements/document';
import type {Actor} from '@/modules/agreements/types';
import {agreementText,cancelAgreement,createAgreement,declineAgreement,finishWithoutWitnesses,investmentFor,joinAgreement,lossShares,renewLink,requestChange,reviseAgreement,signAgreement,verifyEvents,viewFor,witnessAgreement,yourTurn,latest,type Change} from '@/modules/investment-agreements/model';

const abdullah:Actor={userId:'11111111-1111-4111-8111-111111111111',name:'Abdullah Musa',contacts:['abdullah@example.test'],demo:true};
const aisha:Actor={userId:'55555555-5555-4555-8555-555555555555',name:'Aisha Suleiman',contacts:['aisha@example.test'],demo:true};
const musa:Actor={userId:'66666666-6666-4666-8666-666666666666',name:'Musa Ibrahim',contacts:['musa@example.test'],demo:true};
const maryam:Actor={userId:'33333333-3333-4333-8333-333333333333',name:'Maryam Bello',contacts:['maryam@example.test'],demo:true};
const now='2026-11-15T10:00:00.000Z';
const terms={venture:'Sister’s shop in Kano',currency:'NGN',startDate:'2026-11-15'};
const input=(extra:Record<string,unknown>={})=>({terms,me:{capitalMinor:'20000000',profitShare:60},partners:[{name:'Aisha Suleiman',contact:'aisha@example.test',capitalMinor:'10000000',profitShare:40}],signature:'Abdullah Musa',affirmed:true,...extra});
const tokenFor=(c:Change,name:string)=>c.links!.find(l=>l.name===name)!.token;

describe('investment agreements',()=>{
 it('renders the signed agreement as a PDF with every partner and witness',async()=>{
  const created=createAgreement(input({witnesses:[{name:'Maryam Bello',contact:'maryam@example.test'}]}),abdullah,'INV-00000002','k',now);
  let a=joinAgreement(created.agreement,tokenFor(created,'Aisha Suleiman'),aisha,now).agreement;
  a=signAgreement(a,aisha,{expectedVersionId:a.currentVersionId,signature:'Aisha Suleiman',affirmed:true},now).agreement;
  if(a.status!=='ACTIVE'){a=joinAgreement(a,tokenFor(created,'Maryam Bello'),maryam,now).agreement;a=witnessAgreement(a,maryam,{expectedVersionId:a.currentVersionId,signature:'Maryam Bello',affirmed:true},now).agreement;}
  expect(a.status).toBe('ACTIVE');
  const bytes=await renderInvestmentAgreement(a,true);
  expect(bytes.subarray(0,4).toString()).toBe('%PDF');expect(await renderInvestmentAgreement(a,true)).toEqual(bytes);
  await mkdir('output/pdf',{recursive:true});await writeFile('output/pdf/treeti-investment-agreement.pdf',bytes);
 });
 it('splits profit as agreed and loss by money put in, and never promises a return',()=>{
  const loss=lossShares([{partnerId:'a',capitalMinor:'200'},{partnerId:'b',capitalMinor:'100'}]);
  expect(loss.get('a')).toBe(66.7);expect(loss.get('b')).toBe(33.3);
  const text=agreementText([{id:'a',name:'Abdullah Musa'},{id:'b',name:'Aisha Suleiman'}],{venture:'a shop',currency:'NGN',startDate:'2026-11-15',reviewDate:null,manager:null,exit:'',note:''},[{partnerId:'a',capitalMinor:'20000000',profitShare:60},{partnerId:'b',capitalMinor:'10000000',profitShare:40}]);
  expect(text).toContain('Any profit is shared as agreed: Abdullah Musa 60% and Aisha Suleiman 40%.');
  expect(text).toContain('Any loss is shared by how much money each partner put in: Abdullah Musa 66.7% and Aisha Suleiman 33.3%.');
  expect(text).toContain('No partner is promised a fixed return');
 });
 it('needs profit shares that add up to 100 and different people',()=>{
  expect(()=>createAgreement(input({me:{capitalMinor:'100',profitShare:50}}),abdullah,'INV-00000001','k',now)).toThrow(/add up to 100%/);
  expect(()=>createAgreement(input({partners:[{name:'Me Again',contact:'abdullah@example.test',capitalMinor:'1',profitShare:40}]}),abdullah,'INV-00000001','k',now)).toThrow(/not your own/);
  expect(()=>createAgreement(input({partners:Array.from({length:5},(_,i)=>({name:`Partner ${i}`,contact:`p${i}@example.test`,capitalMinor:'1',profitShare:8}))}),abdullah,'INV-00000001','k',now)).toThrow(/Up to 5 people/);
  expect(()=>createAgreement(input({signature:'Someone Else'}),abdullah,'INV-00000001','k',now)).toThrow(/Sign with your name/);
 });
 it('becomes final once every partner signs the same version, then gives each partner a record',()=>{
  const created=createAgreement(input(),abdullah,'INV-00000001','k',now);
  let a=created.agreement;expect(a.status).toBe('AWAITING_SIGNATURES');expect(JSON.stringify(a)).not.toContain(tokenFor(created,'Aisha Suleiman'));
  expect(()=>joinAgreement(a,tokenFor(created,'Aisha Suleiman'),maryam,now)).toThrow(/invitation was sent to/);
  a=joinAgreement(a,tokenFor(created,'Aisha Suleiman'),aisha,now).agreement;
  expect(yourTurn(a,aisha)).toBe('sign');
  const signed=signAgreement(a,aisha,{expectedVersionId:a.currentVersionId,signature:'Aisha Suleiman',affirmed:true},now);
  expect(signed.event).toBe('FINALIZED');expect(signed.agreement.status).toBe('ACTIVE');expect(signed.agreement.finalHash).toMatch(/^[a-f0-9]{64}$/);
  expect(verifyEvents(signed.agreement.events)).toBe(true);
  const record=investmentFor(signed.agreement,signed.agreement.partners[1],'id','cid',now);
  expect(record).toMatchObject({ownerId:aisha.userId,name:'Sister’s shop in Kano',myShare:40,partners:[{name:'Abdullah Musa',share:60}],agreementPublicId:'INV-00000001'});
  expect(record.contributions[0].amountMinor).toBe('10000000');
 });
 it('a change request makes a new version that everyone signs again',()=>{
  const created=createAgreement(input(),abdullah,'INV-00000002','k',now);
  let a=joinAgreement(created.agreement,tokenFor(created,'Aisha Suleiman'),aisha,now).agreement;
  expect(()=>requestChange(a,aisha,{expectedVersionId:a.currentVersionId,note:''},now)).toThrow(/what you’d like changed/);
  a=requestChange(a,aisha,{expectedVersionId:a.currentVersionId,note:'Make it 50/50'},now).agreement;
  expect(a.status).toBe('CHANGES_REQUESTED');expect(yourTurn(a,abdullah)).toBe('revise');
  expect(()=>signAgreement(a,aisha,{expectedVersionId:a.currentVersionId,signature:'Aisha Suleiman',affirmed:true},now)).toThrow(/Wait for the new version/);
  const old=a.currentVersionId;
  a=reviseAgreement(a,abdullah,{expectedVersionId:old,terms,stakes:a.partners.map((p,i)=>({partnerId:p.id,capitalMinor:i?'10000000':'20000000',profitShare:50})),signature:'Abdullah Musa',affirmed:true},now).agreement;
  expect(a.versions).toHaveLength(2);expect(a.status).toBe('AWAITING_SIGNATURES');expect(latest(a).text).toContain('Abdullah Musa 50% and Aisha Suleiman 50%');
  expect(()=>signAgreement(a,aisha,{expectedVersionId:old,signature:'Aisha Suleiman',affirmed:true},now)).toThrow(/changed since you opened it/);
  expect(signAgreement(a,aisha,{expectedVersionId:a.currentVersionId,signature:'Aisha Suleiman',affirmed:true},now).agreement.status).toBe('ACTIVE');
 });
 it('waits for named witnesses, or the writer finishes without them',()=>{
  const created=createAgreement(input({partners:[{name:'Aisha Suleiman',contact:'aisha@example.test',capitalMinor:'5000000',profitShare:25},{name:'Musa Ibrahim',contact:'musa@example.test',capitalMinor:'5000000',profitShare:15}],witnesses:[{name:'Maryam Bello',contact:'maryam@example.test'}]}),abdullah,'INV-00000003','k',now);
  let a=created.agreement;
  for(const [who,name] of [[aisha,'Aisha Suleiman'],[musa,'Musa Ibrahim']] as const){a=joinAgreement(a,tokenFor(created,name),who,now).agreement;a=signAgreement(a,who,{expectedVersionId:a.currentVersionId,signature:name,affirmed:true},now).agreement;}
  expect(a.status).toBe('AWAITING_WITNESSES');
  a=joinAgreement(a,tokenFor(created,'Maryam Bello'),maryam,now).agreement;expect(yourTurn(a,maryam)).toBe('witness');
  expect(viewFor(a,maryam).partners.find(p=>p.name==='Aisha Suleiman')!.contact).toBe('a•••@example.test');
  expect(witnessAgreement(a,maryam,{expectedVersionId:a.currentVersionId,signature:'Maryam Bello',affirmed:true},now).agreement.status).toBe('ACTIVE');
  expect(finishWithoutWitnesses(a,abdullah,{expectedVersionId:a.currentVersionId},now).agreement.attestations).toHaveLength(0);
  expect(()=>finishWithoutWitnesses(a,aisha,{expectedVersionId:a.currentVersionId},now)).toThrow(/Only the person who wrote/);
 });
 it('can be declined, cancelled, and links renewed only for people who haven’t joined',()=>{
  const created=createAgreement(input(),abdullah,'INV-00000004','k',now),a=created.agreement;
  const renewed=renewLink(a,abdullah,{personId:a.partners[1].id},now);
  expect(()=>joinAgreement(renewed.agreement,tokenFor(created,'Aisha Suleiman'),aisha,now)).toThrow(/no longer active/);
  const joined=joinAgreement(renewed.agreement,renewed.links![0].token,aisha,now).agreement;
  expect(declineAgreement(joined,aisha,{expectedVersionId:joined.currentVersionId,note:'Not now'},now).agreement.status).toBe('DECLINED');
  expect(cancelAgreement(a,abdullah,{expectedVersionId:a.currentVersionId},now).agreement.status).toBe('CANCELLED');
  expect(()=>declineAgreement(a,abdullah,{expectedVersionId:a.currentVersionId},now)).toThrow(/Cancel it instead/);
 });
});
