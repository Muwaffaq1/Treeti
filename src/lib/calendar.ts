/** Date-only business rules use the agreement's Nigerian calendar, never the browser clock zone. */
export function calendarDate(value:Date|string=new Date()):string {
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(typeof value==='string'?new Date(value):value);
 const get=(type:string)=>parts.find(p=>p.type===type)!.value;
 return `${get('year')}-${get('month')}-${get('day')}`;
}
