export function maskContact(contact:string){
  if(contact.includes('@')){
    const [name,domain]=contact.split('@');
    return `${name.slice(0,2)}•••@${domain}`;
  }
  return `${contact.slice(0,4)}••••${contact.slice(-3)}`;
}

/**
 * Whether two contacts reach the same inbox. Case and spaces never matter. Gmail ignores dots and
 * anything after "+" in the name, and googlemail.com is the same service, so those count as one address.
 */
export function sameContact(a:string,b:string){
  const norm=(v:string)=>{
    const c=v.trim().toLowerCase();if(!c.includes('@'))return c;
    const [name,domain]=c.split('@');
    if(domain==='gmail.com'||domain==='googlemail.com')return `${name.split('+')[0].replaceAll('.','')}@gmail.com`;
    return c;
  };
  return norm(a)===norm(b);
}
