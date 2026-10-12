/** Preserve old invitation paths without forwarding sessions or mutations. */
export function stagingRedirect(request:Pick<Request,'url'|'method'>):URL|null {
  if(process.env.AHD_RUNTIME!=='cloudflare'||!['GET','HEAD'].includes(request.method))return null;
  const canonical=process.env.AHD_APP_URL;
  if(!canonical)return null;
  const target=new URL(canonical),source=new URL(request.url);
  const allowedSources=target.origin==='https://usetreeti.xyz'
    ?['https://staging.usetreeti.xyz','https://ahd-staging.yusufmuwaffaq17.workers.dev']
    :target.origin==='https://staging.usetreeti.xyz'?['https://ahd-staging.yusufmuwaffaq17.workers.dev']:[];
  if(!allowedSources.includes(source.origin))return null;
  target.pathname=source.pathname;
  target.search=source.search;
  return target;
}
