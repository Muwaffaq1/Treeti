// The same person always gets the same colour (one of six hues), on cards, the people bar and avatars.
export const PERSON_HUES=6;
export function personHue(name:string){let h=0;for(const c of name)h=(h*31+c.charCodeAt(0))>>>0;return h%PERSON_HUES;}
export const initials=(name:string)=>name.split(' ').map(part=>part[0]).slice(0,2).join('');
export const firstName=(name:string)=>name.split(' ')[0];
