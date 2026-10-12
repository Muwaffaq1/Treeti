import { randomUUID } from 'node:crypto';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { database } from '@/lib/database';
import { json } from '@/lib/http';
import { sha256 } from '@/lib/crypto';
import { supabaseAdmin } from '@/lib/supabase/server';
import { DomainError, member } from '@/modules/agreements/domain';
import type { Actor, Aggregate } from '@/modules/agreements/types';
export async function proofUpload(req:Request,a:Aggregate|null,actor:Actor){
  if(!a||!member(a,actor)||member(a,actor)?.role==='WITNESS'||a.status!=='ACTIVE')throw new DomainError('PARTICIPANT_NOT_AUTHORIZED','Only the parties can add proof to an active agreement.',403);
  const length=Number(req.headers.get('content-length'));if(!length||length>5400000)throw new DomainError('FILE_TOO_LARGE','Choose a PDF, PNG or JPEG up to 5 MB.',413);
  const form=await req.formData(),file=form.get('file');if(!(file instanceof File)||file.size>5242880)throw new DomainError('FILE_TOO_LARGE','Choose a PDF, PNG or JPEG up to 5 MB.',413);
  const bytes=Buffer.from(await file.arrayBuffer());
  const type=bytes.subarray(0,5).toString()==='%PDF-'?'application/pdf':bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':null;
  if(!type)throw new DomainError('FILE_TYPE_UNSUPPORTED','Choose a PDF, PNG or JPEG file.',422);
  const id=randomUUID(),path=`${a.id}/proofs/${id}`,meta={agreementId:a.id,userId:actor.userId,type,sha256:sha256(bytes)};
  if(actor.demo){const dir=join(process.cwd(),'.ahd-demo','proofs');await mkdir(dir,{recursive:true});await writeFile(join(dir,id),bytes,{mode:0o600});await writeFile(join(dir,`${id}.json`),JSON.stringify(meta),{mode:0o600});}
  else{const {error}=await supabaseAdmin().storage.from('repayment-proofs-private').upload(path,bytes,{contentType:type,upsert:false});if(error)throw new Error('Proof upload failed');await database().query('insert into artifacts (id,agreement_id,version_id,kind,storage_path,sha256,data) values ($1,$2,$3,\'PROOF\',$4,$5,$6)',[id,a.id,a.currentVersionId,path,meta.sha256,JSON.stringify(meta)]);}
  return json({proofId:id});
}
export async function validateProof(id:string,a:Aggregate,actor:Actor){
  z.string().uuid().parse(id);
  const meta=actor.demo?JSON.parse(await readFile(join(process.cwd(),'.ahd-demo','proofs',`${id}.json`),'utf8')):(await database().query<{data:{agreementId:string;userId:string}}>('select data from artifacts where id=$1 and kind=\'PROOF\'',[id]))[0]?.data;
  if(!meta||meta.agreementId!==a.id||meta.userId!==actor.userId)throw new DomainError('PARTICIPANT_NOT_AUTHORIZED','Choose a proof file you uploaded for this agreement.',403);
}
export async function proofResponse(a:Aggregate,actor:Actor,id:string){
  z.string().uuid().parse(id);if(!member(a,actor)||member(a,actor)?.role==='WITNESS'||!a.repayments.some(r=>r.proofId===id))throw new DomainError('PARTICIPANT_NOT_AUTHORIZED','This proof is private to the agreement parties.',403);
  if(actor.demo){const meta=JSON.parse(await readFile(join(process.cwd(),'.ahd-demo','proofs',`${id}.json`),'utf8')),bytes=await readFile(join(process.cwd(),'.ahd-demo','proofs',id));if(meta.agreementId!==a.id||sha256(bytes)!==meta.sha256)throw new Error('Proof integrity failed');return new Response(bytes,{headers:{'Content-Type':meta.type,'Content-Disposition':'attachment; filename="repayment-proof"','Cache-Control':'private, no-store'}});}
  const [row]=await database().query<{storage_path:string}>('select storage_path from artifacts where id=$1 and agreement_id=$2 and kind=\'PROOF\'',[id,a.id]);if(!row)throw new DomainError('NOT_FOUND','This proof is unavailable.',404);
  const {data,error}=await supabaseAdmin().storage.from('repayment-proofs-private').createSignedUrl(row.storage_path,60,{download:true});if(error||!data)throw new Error('Proof download failed');return Response.redirect(data.signedUrl,303);
}
