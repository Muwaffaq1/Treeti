// The same person always gets the same colour (one of six hues), on cards, the people bar and avatars.
export const PERSON_HUES=6;
export function personHue(name:string){let h=0;for(const c of name)h=(h*31+c.charCodeAt(0))>>>0;return h%PERSON_HUES;}
// Initials from whole graphemes (Intl.Segmenter), letters and digits only: an emoji or symbol never
// becomes half an initial, which also kept server and browser output from matching. First and last word.
const LETTER=/^[\p{L}\p{N}]/u,SUFFIX=/^(jr|sr|ii|iii|iv)\.?$/i;
const graphemes=(word:string)=>typeof Intl!=='undefined'&&'Segmenter' in Intl?Array.from(new Intl.Segmenter('en',{granularity:'grapheme'}).segment(word),s=>s.segment):Array.from(word);
const firstLetter=(word:string)=>graphemes(word).find(g=>LETTER.test(g))??'';
export const initials=(name:string)=>{const words=name.trim().split(/\s+/).filter(w=>!SUFFIX.test(w)).map(firstLetter).filter(Boolean);return (words.length>2?[words[0],words.at(-1)!]:words).join('').toLocaleUpperCase()||'?';};
export const firstName=(name:string)=>name.trim().split(/\s+/).find(w=>/[\p{L}\p{N}]/u.test(w))??name.trim();
