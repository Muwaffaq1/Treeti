import {database} from '@/lib/database';
import {sha256} from '@/lib/crypto';
import {supabaseAdmin} from '@/lib/supabase/server';
import {DomainError} from '@/modules/agreements/domain';
import type {Aggregate} from '@/modules/agreements/types';
import {verifyIntegrity} from './service';
export async function verificationResult(a:Aggregate|null,demo=false){
  if(!a?.manifest)throw new DomainError('RECORD_NOT_FOUND','No finalized record was found for this identifier. Check it and try again.',404);
  let documentStatus=demo?'DEMONSTRATION':'PENDING';
  if(!demo){const [artifact]=await database().query<{storage_path:string;sha256:string}>('select storage_path,sha256 from artifacts where agreement_id=$1 and kind=\'AGREEMENT\' order by case when data->>\'presentationVersion\'=\'2\' then 0 else 1 end,created_at desc,id desc',[a.id]);if(artifact){const {data,error}=await supabaseAdmin().storage.from('ahd-evidence').download(artifact.storage_path);if(error||!data)documentStatus='UNAVAILABLE';else documentStatus=sha256(new Uint8Array(await data.arrayBuffer()))===artifact.sha256?'MATCHED':'MISMATCH';}}
  return {publicId:a.publicId,hashConsistent:verifyIntegrity(a),finalizedAt:a.manifest.finalizedAt,version:a.manifest.version.number,documentStatus,externalSeal:false};
}
