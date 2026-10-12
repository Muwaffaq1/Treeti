import {z} from 'zod';
import {database} from '@/lib/database';
import {failure,json} from '@/lib/http';
import {rateLimit} from '@/lib/rate-limit';
import {DomainError} from '@/modules/agreements/domain';
import {PostgresRepository} from '@/modules/agreements/repository';
import {verificationResult} from '@/modules/documents/verification';
export async function GET(req:Request,{params}:{params:Promise<{publicId:string}>}){try{const {publicId}=await params;z.string().regex(/^(?:AHD|TREETI)-\d{4}-\d{3,10}$/).parse(publicId);await rateLimit(`verify:${req.headers.get('x-forwarded-for')||'local'}`,30);if(!process.env.SUPABASE_DB_URL)throw new DomainError('SETUP_REQUIRED','Record verification is waiting for the database connection.',503);const db=database(),[row]=await db.query<{id:string}>('select id from agreements where public_id=$1',[publicId]);const a=row?await new PostgresRepository(db).get(row.id):null;return json(await verificationResult(a));}catch(e){return failure(e);}}
