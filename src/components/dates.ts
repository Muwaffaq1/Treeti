// Short, friendly dates used by the home brief and the agreements list (Nigerian calendar, UTC noon).
export const DAY=86_400_000;
export const daysBetween=(from:string,to:string)=>Math.round((Date.parse(`${to}T12:00:00Z`)-Date.parse(`${from}T12:00:00Z`))/DAY);
export const weekday=(date:string)=>new Intl.DateTimeFormat('en-GB',{weekday:'long',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`));
export const shortDate=(date:string)=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`));
/** "today", "tomorrow", "on Friday" this week, "in 12 days" this month, then "on 3 Feb". */
export function when(date:string,today:string){const d=daysBetween(today,date);if(d===0)return 'today';if(d===1)return 'tomorrow';if(d>1&&d<7)return `on ${weekday(date)}`;if(d>=7&&d<=31)return `in ${d} days`;return `on ${shortDate(date)}`;}
/** "Friday", "2 Dec", "Today": the short form used beside amounts. */
export function nextWhen(date:string,today:string){const w=when(date,today).replace(/^on /,'');return daysBetween(today,date)<0?`was due ${shortDate(date)}`:w.charAt(0).toUpperCase()+w.slice(1);}

