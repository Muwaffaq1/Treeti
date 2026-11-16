import {describe,it,expect} from 'vitest';
import {currencies} from '@/lib/currencies';
import {createInvestment,changeInvestment,investmentTotal,investmentTotals,isShared} from '@/modules/investments/model';
const now='2026-10-11T12:00:00Z',owner='owner',first='11111111-1111-4111-8111-111111111111',second='22222222-2222-4222-8222-222222222222';
const input={name:'My business',currency:'GBP',amountMinor:'130001',date:'2026-10-01',note:'Initial capital'};
describe('private investment records',()=>{
  it('supports each currency and keeps exact totals separate without converting or counting archived records',()=>{
    const records=currencies.map(currency=>createInvestment({...input,currency},owner,currency,first,now));
    const record=changeInvestment(records[0],{action:'contribute',amountMinor:'25',date:'2026-10-05',expectedRevision:0},owner,second,now);
    expect(investmentTotal(record)).toBe('130026');expect(records[0].contributions).toHaveLength(1);
    const totals=investmentTotals([record,...records.slice(1)]);expect(totals).toHaveLength(currencies.length);expect(totals.find(t=>t.currency===record.currency)?.amountMinor).toBe('130026');
    const archived=changeInvestment(record,{action:'archive',archived:true,expectedRevision:1},owner,second,now);
    expect(investmentTotals([archived,...records.slice(1)])).toHaveLength(currencies.length-1);expect(archived.contributions).toEqual(record.contributions);
  });
  it('corrects contributions without rewriting other amounts, and fixes currency only before further contributions',()=>{
    let record=createInvestment(input,owner,'investment',first,now);
    record=changeInvestment(record,{action:'edit',name:'My property',currency:'NGN',note:'Corrected',expectedRevision:0},owner,second,now);
    record=changeInvestment(record,{action:'contribute',amountMinor:'99999999999999',date:'2026-10-02',expectedRevision:1},owner,second,now);
    expect(investmentTotal(record)).toBe('100000000130000');
    const corrected=changeInvestment(record,{action:'edit-contribution',contributionId:first,amountMinor:'200',date:'2026-09-30',note:'Corrected amount',expectedRevision:2},owner,second,now);
    expect(corrected.contributions[1]).toEqual(record.contributions[1]);expect(corrected.contributions[0].createdAt).toBe(now);expect(corrected.contributions[0].updatedAt).toBe(now);
    expect(()=>changeInvestment(corrected,{action:'edit',name:'My property',currency:'USD',expectedRevision:3},owner,second,now)).toThrow('currency cannot change');
  });
  it('rejects ownership mistakes, stale edits, invalid money/dates and contributions to archived records',()=>{
    const record=createInvestment(input,owner,'investment',first,now);
    const change={action:'contribute',amountMinor:'1',date:'2026-10-02',expectedRevision:0};
    expect(()=>changeInvestment(record,change,'other',second,now)).toThrow('unavailable');
    expect(()=>changeInvestment(record,{...change,expectedRevision:1},owner,second,now)).toThrow('changed since');
    for(const amountMinor of ['0','-1','1.2','999999999999999'])expect(()=>createInvestment({...input,amountMinor},owner,'id',first,now)).toThrow();
    for(const date of ['2026-02-30','2026-10-12'])expect(()=>createInvestment({...input,date},owner,'id',first,now)).toThrow();
    expect(()=>createInvestment({...input,currency:'JPY'},owner,'id',first,now)).toThrow();
    const archived=changeInvestment(record,{action:'archive',archived:true,expectedRevision:0},owner,second,now);
    expect(()=>changeInvestment(archived,{...change,expectedRevision:1},owner,second,now)).toThrow('Restore');
    const restored=changeInvestment(archived,{action:'archive',archived:false,expectedRevision:1},owner,second,now);
    expect(changeInvestment(restored,{...change,expectedRevision:2},owner,second,now).contributions).toHaveLength(2);
    expect(()=>changeInvestment(record,{action:'edit-contribution',contributionId:second,amountMinor:'1',date:'2026-10-01',expectedRevision:0},owner,second,now)).toThrow('unavailable');
  });
  it('records who shares an investment, requires shares to total 100% and keeps sharing through older edits',()=>{
    const shared=createInvestment({...input,partners:[{name:'Aisha Bello',share:40}],myShare:60},owner,first,first,now);
    expect(isShared(shared)).toBe(true);expect(shared.myShare).toBe(60);expect(investmentTotal(shared)).toBe('130001');
    expect(isShared(createInvestment(input,owner,first,first,now))).toBe(false);expect(createInvestment({...input,partners:[]},owner,first,first,now)).not.toHaveProperty('partners');
    expect(()=>createInvestment({...input,partners:[{name:'Aisha Bello',share:40}],myShare:50},owner,first,first,now)).toThrow('add up to 100%');
    expect(()=>createInvestment({...input,partners:[{name:'Aisha Bello',share:40}]},owner,first,first,now)).toThrow('add up to 100%');
    expect(()=>createInvestment({...input,partners:[{name:'Aisha Bello',share:40.5}],myShare:59.5},owner,first,first,now)).toThrow();
    expect(()=>createInvestment({...input,partners:Array.from({length:6},(_,i)=>({name:`Person ${i}`,share:10})),myShare:40},owner,first,first,now)).toThrow('up to 5');
    const renamed=changeInvestment(shared,{action:'edit',name:'Sister’s shop',currency:'GBP',note:'',expectedRevision:0},owner,second,now);
    expect(renamed.partners).toEqual(shared.partners);expect(renamed.myShare).toBe(60);
    const solo=changeInvestment(renamed,{action:'edit',name:'Sister’s shop',currency:'GBP',note:'',partners:[],expectedRevision:1},owner,second,now);
    expect(isShared(solo)).toBe(false);expect(solo).not.toHaveProperty('myShare');
  });
});
