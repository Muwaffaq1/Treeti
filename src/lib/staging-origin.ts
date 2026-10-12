/** Preserve old invitation paths without forwarding sessions or mutations. */
export function stagingRedirect(request:Pick<Request,'url'|'method'>):URL|null {
  if(process.env.AHD_RUNTIME!=='cloudflare'||!['GET','HEAD'].includes(request.method))return null;
  const canonical=process.env.AHD_APP_URL;
  if(!canonical)return null;
  const target=new URL(canonical),source=new URL(request.url);
  if(target.origin!=='https://staging.usetreeti.xyz'||source.origin!=='https://ahd-staging.yusufmuwaffaq17.workers.dev')return null;
  target.pathname=source.pathname;
  target.search=source.search;
  return target;
}
