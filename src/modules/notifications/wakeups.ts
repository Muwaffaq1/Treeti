import {after} from 'next/server';
import {sha256} from '@/lib/crypto';
import type {DebtReminder} from '@/modules/debts/reminders';
import {inngest} from './client';

function enqueue(event: {id: string; name: string; data: Record<string, string>; ts?: number}) {
  if (!process.env.INNGEST_EVENT_KEY) return;
  const failed=()=>console.error('treeti background wakeup failed', {type: 'JOB_EVENT_SEND_FAILED', job: event.name});
  try {
    after(async () => { try { await inngest.send(event); } catch { failed(); } });
  } catch { failed(); }
}

export function queueAgreementDelivery(agreementId: string, actorId: string, requestKey: string) {
  enqueue({id: `outbox-${sha256(`${agreementId}:${actorId}:${requestKey}`)}`, name: 'ahd/jobs/deliver-outbox', data: {agreementId}});
}

export function queueDebtReminder(reminder?: DebtReminder | null) {
  if (!reminder?.email || reminder.emailSentAt || reminder.emailFailed) return;
  enqueue({id: `personal-reminder-${reminder.id}`, name: 'ahd/jobs/personal-debt-reminders', data: {reminderId: reminder.id}, ts: Date.parse(reminder.remindAt)});
}
