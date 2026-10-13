/**
 * Home and sign-in are ready-made pages, so the page itself decides whether to move on.
 * This runs in the browser, from the document head, before the page paints. It must stay self-contained (no imports,
 * no outer variables) because its source text is embedded in the page.
 *
 * A session cookie only starts the move: the private page still verifies the session,
 * and sends an expired one back to sign-in, where the short rest below stops a loop.
 */
export function entryRedirect(){
  try{
    const l=location,root=document.documentElement;
    // Embedded in every page's head, but only the two ready-made entry pages act on it.
    if(l.pathname!=='/'&&l.pathname!=='/login')return;
    const go=function(to:string){root.dataset.leaving='1';setTimeout(function(){delete root.dataset.leaving;},4000);l.replace(to);};
    // Pages opened on an earlier address move to the current one.
    if(l.hostname==='staging.usetreeti.xyz'||l.hostname==='ahd-staging.yusufmuwaffaq17.workers.dev'){go('https://usetreeti.xyz'+l.pathname+l.search);return;}
    if(!/(?:^|; )sb-[a-z0-9]+-auth-token(?:\.\d+)?=/.test(document.cookie))return;
    const key='treeti:entry-redirect',now=Date.now();
    if(now-Number(sessionStorage.getItem(key)||0)<15000)return;
    sessionStorage.setItem(key,String(now));
    let to='/app';
    if(l.pathname==='/login'){
      // Same allow-list as authReturnPath in auth-return.ts; a test keeps the two in step.
      const next=new URLSearchParams(l.search).get('next');
      if(next&&(/^\/(app|account|activity|debts|agreements)(\/[^\\?#\s]*)?$/.test(next)||/^\/invite\/[A-Za-z0-9_-]{43}$/.test(next)))to=next;
    }
    go(to);
  }catch{/* Storage or cookies unavailable: stay on the public page. */}
}
export const entryRedirectScript=`(${entryRedirect.toString()})();`;
