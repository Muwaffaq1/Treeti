export function parseMoney(value: string): string {
  const cleaned = value.trim().replaceAll(',', '');
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(cleaned)) throw new Error('Enter a positive amount with at most two decimal places.');
  const [whole, fraction = ''] = cleaned.split('.');
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (minor <= 0n || minor > 99999999999999n) throw new Error('Enter an amount greater than zero, up to 999,999,999,999.99.');
  return minor.toString();
}
export function money(minor: string,currency:string): string {
  const value = BigInt(minor);
  const whole = value / 100n, fraction = value % 100n;
  return `${currency==='NGN'?'₦':`${currency} `}${whole.toLocaleString('en-NG')}${fraction ? `.${fraction.toString().padStart(2, '0')}` : ''}`;
}
export function moneyInput(minor: string): string {
  const v = BigInt(minor); return `${v / 100n}.${(v % 100n).toString().padStart(2, '0')}`;
}

/** Group a draft amount without numerical conversion, rounding or hiding invalid input. */
export function groupMoneyInput(value:string):string {
  const raw=value.replaceAll(',','');
  if(!/^\d*(\.\d*)?$/.test(raw))return value;
  const [whole,fraction]=raw.split('.');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(fraction===undefined?'':`.${fraction}`);
}

export function moneyEdit(value:string,caret:number) {
  const formatted=groupMoneyInput(value);
  if(formatted===value)return {value,caret};
  const meaningful=value.slice(0,caret).replaceAll(',','').length;
  let position=0,seen=0;
  while(position<formatted.length&&seen<meaningful){if(formatted[position]!==',')seen++;position++;}
  return {value:formatted,caret:position};
}
