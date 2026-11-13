/**
 * ГРОТ 2.0: добавление встроенной истории 2026 только по явному действию
 * пользователя пробного экрана. Исходная резервная копия неизменна.
 * Не делает вывод о том, были ли отпуска фактически использованы.
 */
const clone=x=>JSON.parse(JSON.stringify(x));
const key=r=>[r.year,String(r.staffId??'').trim(),r.period?.start,r.period?.end].join('|');
export function stageBundledHistory(records,review){
 if(!Array.isArray(records)||!review||!Array.isArray(review.records))
  throw new TypeError('Не переданы исходные записи или отчёт истории');
 const next=clone(records),seen=new Set(next.map(key));
 let added=0,duplicates=0,unresolved=0;
 for(const row of review.records){
  if(row.requiresReview||!row.staffId){unresolved++;continue;}
  const signature=key(row);
  if(seen.has(signature)){duplicates++;continue;}
  if(next.some(r=>String(r.id)===String(row.id)))
   throw new Error('Конфликт идентификатора: '+row.id);
  const period={...row.period};
  const sameEmployee=next.filter(r=>!r.deleted&&Number(r.year)===2026&&
    String(r.staffId)===String(row.staffId));
  if(sameEmployee.some(r=>r.period?.start<=period.end&&period.start<=r.period?.end))
   throw new Error('Найдено пересечение с уже загруженной историей: '+row.staffName);
  next.push({...clone(row),verificationStatus:'unverified-source',requiresReview:true});
  seen.add(signature);added++;
 }
 return {records:next,counts:{added,duplicates,unresolved},source:'src/history2026.js'};
}
