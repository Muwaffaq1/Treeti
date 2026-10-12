import type {ChangeEvent} from 'react';
import {moneyEdit} from '@/lib/money';

/** Apply before a form's onChange handler; preserve the selection while inserting grouping commas. */
export function formatMoneyChange(event:ChangeEvent<HTMLInputElement>) {
  const input=event.currentTarget,raw=input.value;
  const start=moneyEdit(raw,input.selectionStart??raw.length),end=moneyEdit(raw,input.selectionEnd??raw.length);
  input.value=start.value;
  input.setSelectionRange(start.caret,end.caret);
}
