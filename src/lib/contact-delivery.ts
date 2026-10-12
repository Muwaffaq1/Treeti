import {DomainError} from '@/modules/agreements/domain';

// Enable phone delivery only after both SMS verification and notifications exist.
export function emailDeliveryAvailable(contact:string){return contact.includes('@');}
export function requireEmailDelivery(contact:string){
  if(!emailDeliveryAvailable(contact))throw new DomainError('PHONE_DELIVERY_UNAVAILABLE','Phone verification is not available yet. Use an email address for sign-in and invitations.',422);
}
export function confirmationEmail(contacts:string[]){
  const email=contacts.find(emailDeliveryAvailable);
  if(!email)throw new DomainError('EMAIL_VERIFICATION_REQUIRED','A verified email address is needed to confirm this action. Phone verification is not available yet.',422);
  return email;
}
