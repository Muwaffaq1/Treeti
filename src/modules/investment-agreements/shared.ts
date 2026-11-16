// Browser-safe pieces of investment agreements: limits, the promise wording and the loss-share maths.
export const partnerLimit=5,witnessLimit=2;
export const partnerAffirmation='I have read this investment agreement. The money I am putting in and my share of any profit are correct. I understand that any loss is shared by how much money each partner put in, and that no partner is promised a fixed return.';
export const witnessAffirmation='I have read this investment agreement and I witness that the partners agreed to it. I am not a partner, and I do not guarantee any money or result.';

/** Loss shares follow the money: each partner's capital over the total, rounded to one decimal place. */
export function lossShares(stakes:{partnerId:string;capitalMinor:string}[]){
  const total=stakes.reduce((sum,s)=>sum+BigInt(s.capitalMinor),0n);
  return new Map(stakes.map(s=>[s.partnerId,total?Number((BigInt(s.capitalMinor)*2000n+total)/(2n*total))/10:0]));
}
export const percent=(n:number)=>`${Number.isInteger(n)?n:n.toFixed(1)}%`;
/** Whole-number profit shares in proportion to the money, adjusted so they add up to exactly 100. */
export function sharesByMoney(capitals:bigint[]){
  const total=capitals.reduce((a,b)=>a+b,0n);if(!total)return capitals.map(()=>0);
  const raw=capitals.map(c=>Number(c*10000n/total)/100),shares=raw.map(r=>Math.max(1,Math.floor(r)));
  let left=100-shares.reduce((a,b)=>a+b,0);
  const order=raw.map((r,i)=>[r-Math.floor(r),i] as const).sort((a,b)=>b[0]-a[0]);
  for(let k=0;left>0;k=(k+1)%order.length,left--)shares[order[k][1]]++;
  for(let k=0;left<0;k++){const i=shares.indexOf(Math.max(...shares));shares[i]--;left++;}
  return shares;
}
