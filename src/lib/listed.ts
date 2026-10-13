import type {Metadata} from 'next';
/**
 * Every page is hidden from search engines by default (see the root layout).
 * Only pages that are the same for everyone opt in here, with the one address they should be listed under.
 */
export const listed=(path:string):Pick<Metadata,'robots'|'alternates'>=>({robots:{index:true,follow:true},alternates:{canonical:path}});
