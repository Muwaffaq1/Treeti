export function maskContact(contact:string){
  if(contact.includes('@')){
    const [name,domain]=contact.split('@');
    return `${name.slice(0,2)}•••@${domain}`;
  }
  return `${contact.slice(0,4)}••••${contact.slice(-3)}`;
}
