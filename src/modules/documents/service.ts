import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { database } from '@/lib/database';
import { digest, sha256 } from '@/lib/crypto';
import { supabaseAdmin } from '@/lib/supabase/server';
import { DomainError, member, verifyEvents } from '@/modules/agreements/domain';
import type { Actor, Aggregate } from '@/modules/agreements/types';
import {qualifyingWitnesses, satisfiesWitnessPolicy, usesDigitalWitnesses} from '@/modules/agreements/witness-policy';
import { renderAgreement } from './pdf';
export function verifyIntegrity(a:Aggregate){
  if(!a.manifest)return false;
  const {hash,...manifest}=a.manifest,root=a.events.find(e=>e.hash===manifest.auditRoot);
  return !!root&&digest(manifest)===hash&&digest(manifest.version.payload)===manifest.version.hash&&verifyEvents(a.events.slice(0,root.sequence))&&a.versions.some(v=>v.id===manifest.version.id&&digest(v)===digest(manifest.version))&&manifest.approvals.length===2&&new Set(manifest.approvals.map(p=>p.role)).size===2&&manifest.approvals.every(p=>['LENDER','BORROWER'].includes(p.role)&&p.action==='ACCEPTED'&&p.versionId===manifest.version.id&&p.versionHash===manifest.version.hash)&&manifest.attestations.every(w=>w.versionId===manifest.version.id&&w.versionHash===manifest.version.hash&&(!usesDigitalWitnesses(manifest.version)||satisfiesWitnessPolicy(manifest.version,w)))&&qualifyingWitnesses(manifest.version,manifest.attestations,manifest.participants).length>=manifest.version.terms.requiredWitnesses;
}
export async function ensureArtifact(a:Aggregate,kind:'pdf'|'settlement'|'receipt',paymentId?:string|null){
  const db=database(),artifactKind=kind==='pdf'?'AGREEMENT':kind==='settlement'?'SETTLEMENT':'RECEIPT';
  // Layout revisions append a new presentation; they never overwrite an earlier
  // saved document or alter the finalized terms and participant evidence.
  const presentationVersion=kind==='pdf'?'2':null;
  const [existing]=await db.query<{storage_path:string;sha256:string}>('select storage_path,sha256 from artifacts where agreement_id=$1 and kind=$2 and repayment_id is not distinct from $3 and ($4::text is null or data->>\'presentationVersion\'=$4) order by created_at,id', [a.id,artifactKind,paymentId??null,presentationVersion]);
  const storage=supabaseAdmin().storage.from('ahd-evidence');
  if(existing){const {data,error}=await storage.download(existing.storage_path);if(error||!data)throw new Error('Artifact download failed');const bytes=Buffer.from(await data.arrayBuffer());if(sha256(bytes)!==existing.sha256)throw new DomainError('INTEGRITY_FAILED','The saved document could not be verified. Contact treeti before relying on it.',503);return bytes;}
  const bytes=await renderAgreement(a,kind,paymentId,false),path=`${a.id}/${a.manifest!.version.id}/${artifactKind.toLowerCase()}${presentationVersion?`-presentation-v${presentationVersion}`:''}${paymentId?`-${paymentId}`:''}.pdf`;
  const {error}=await storage.upload(path,bytes,{contentType:'application/pdf',upsert:false});
  if(error){
    // Concurrent deterministic generation: read the winner, never overwrite evidence.
    const {data}=await storage.download(path);if(!data)throw error;const winner=Buffer.from(await data.arrayBuffer());if(sha256(winner)!==sha256(bytes))throw new Error('Conflicting evidence artifact');
  }
  await db.query('insert into artifacts (id,agreement_id,version_id,kind,storage_path,sha256,repayment_id,data) values ($1,$2,$3,$4,$5,$6,$7,$8) on conflict do nothing',[randomUUID(),a.id,a.manifest!.version.id,artifactKind,path,sha256(bytes),paymentId??null,JSON.stringify({manifestHash:a.manifest!.hash,...(presentationVersion?{presentationVersion}:{})})]);return bytes;
}
export async function documentResponse(a:Aggregate,actor:Actor,kind:'pdf'|'settlement'|'receipt',paymentId?:string|null){
  const p=member(a,actor);if(!p)throw new DomainError('PARTICIPANT_NOT_AUTHORIZED','This document is private.',403);
  if(!a.manifest)throw new DomainError('NOT_FINALIZED','The PDF is available after the agreement is finalized.');
  if(p.role==='WITNESS'&&(kind!=='pdf'||!p.versionIds.includes(a.manifest.version.id)))throw new DomainError('PARTICIPANT_NOT_AUTHORIZED','Witnesses can download only the agreement version they witnessed.',403);
  if(kind==='settlement'&&a.status!=='SETTLED')throw new DomainError('SETTLEMENT_NOT_COMPLETE','Both parties must acknowledge settlement before this record is available.');
  if(kind==='receipt'&&!a.repayments.some(r=>r.id===paymentId&&r.status==='CONFIRMED'))throw new DomainError('PAYMENT_NOT_CONFIRMED','The receipt is available after the other party confirms this payment.');
  if(!verifyIntegrity(a))throw new DomainError('INTEGRITY_FAILED','This record could not be verified. Contact treeti before relying on it.',503);
  const bytes=actor.demo?await renderAgreement(a,kind,paymentId,true):await ensureArtifact(a,kind,paymentId);
  return new NextResponse(new Uint8Array(bytes),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${a.publicId}-${kind}.pdf"`,'Cache-Control':'private, no-store','X-Ahd-Document-Hash':sha256(bytes)}});
}
