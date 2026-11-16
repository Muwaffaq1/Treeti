// Browser-safe pieces of investment agreements: limits, the promise wording and money shares.
export const partnerLimit=5,witnessLimit=2;
export const partnerAffirmation='I have read this investment agreement. The amount I am putting in is correct, and I agree to invest together with the partners named in it.';
export const witnessAffirmation='I have read this investment agreement and I witness that the partners agreed to it. I am not a partner, and I do not guarantee any money or result.';

/** Whole-number shares in proportion to the money put in, adjusted so they add up to exactly 100. */
export function sharesByMoney(capitals:bigint[]){
  const total=capitals.reduce((a,b)=>a+b,0n);if(!total)return capitals.map(()=>0);
  const raw=capitals.map(c=>Number(c*10000n/total)/100),shares=raw.map(r=>Math.max(1,Math.floor(r)));
  let left=100-shares.reduce((a,b)=>a+b,0);
  const order=raw.map((r,i)=>[r-Math.floor(r),i] as const).sort((a,b)=>b[0]-a[0]);
  for(let k=0;left>0;k=(k+1)%order.length,left--)shares[order[k][1]]++;
  for(let k=0;left<0;k++){const i=shares.indexOf(Math.max(...shares));shares[i]--;left++;}
  return shares;
}
