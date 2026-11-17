/** Date-only business rules use the agreement's Nigerian calendar, never the browser clock zone. */
export function calendarDate(value:Date|string=new Date()):string {
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(typeof value==='string'?new Date(value):value);
 const get=(type:string)=>parts.find(p=>p.type===type)!.value;
 return `${get('year')}-${get('month')}-${get('day')}`;
}
/** The person's own date on this device. For reminders, which are moments on their clock, not agreement dates. */
export function localCalendarDate(value:Date=new Date()):string {
 return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;
}
