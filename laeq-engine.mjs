const DAY=86400000;
export const fmt=ms=>{const d=new Date(ms),p=n=>String(n).padStart(2,'0');return `${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`};
export const num=v=>{const m=String(v??'').replace(',','.').match(/-?\d+(?:\.\d+)?/);return m?+m[0]:NaN};
export function csv(text,sep){const out=[];let r=[],f='',q=false,s