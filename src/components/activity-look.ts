// The icon and tone for each kind of agreement event, shared by Activity and Notifications.
import {BadgeCheck,Bell,Check,FilePenLine,History,MessageSquareMore,Send,ShieldCheck,UsersRound,WalletCards} from '@/components/icons';
export function activityAppearance(type:string){
  if(['LENDER_APPROVED','BORROWER_APPROVED'].includes(type))return {Icon:BadgeCheck,tone:'confirmed'};
  if(['WITNESS_INVITED','WITNESS_ATTESTED','WITNESS_DECLINED'].includes(type))return {Icon:UsersRound,tone:type==='WITNESS_ATTESTED'?'confirmed':'neutral'};
  if(['AGREEMENT_FINALIZED','AGREEMENT_SETTLED','SETTLEMENT_ACKNOWLEDGED'].includes(type))return {Icon:ShieldCheck,tone:'confirmed'};
  if(type==='REPAYMENT_CONFIRMED')return {Icon:Check,tone:'confirmed'};
  if(type==='REPAYMENT_PROPOSED')return {Icon:WalletCards,tone:'pending'};
  if(['REPAYMENT_DISPUTED','BORROWER_REQUESTED_CHANGE'].includes(type))return {Icon:MessageSquareMore,tone:'pending'};
  if(type==='BORROWER_INVITED')return {Icon:Send,tone:'neutral'};
  if(['AGREEMENT_CREATED','VERSION_CREATED'].includes(type))return {Icon:FilePenLine,tone:'neutral'};
  if(type==='INVITED_TO_REVIEW')return {Icon:Send,tone:'pending'};
  return {Icon:type?History:Bell,tone:'neutral'};
}
