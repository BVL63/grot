/**
 * ГРОТ 2.0: журнал корректировок — отдельный запрос, вне таблицы графика.
 * Только подтверждённые действия, находящиеся в record.audit.
 * Фильтрация по году и ФИО, изменения исходных данных не выполняются.
 */
export function queryVacationAudit(records,{year=null,search=''}={}){
 if(!Array.isArray(records))throw new TypeError('Список записей должен быть массивом');
 const needle=String(search).trim().toLocaleLowerCase('ru').replace(/ё/g,'е');
 const lines=[];
 for(const rec of records){
  if(year!==null&&Number(rec.year)!==Number(year))continue;
  const person=String(rec.staffName||'');
  if(needle&&!person.toLocaleLowerCase('ru').replace(/ё/g,'е').includes(needle))continue;
  for(const change of Array.isArray(rec.audit)?rec.audit:[]){
   if(!change||typeof change!=='object')continue;
   lines.push({recordId:String(rec.id),year:Number(rec.year),employee:person,
    date:String(change.at||''),actor:String(change.actor||''),
    reason:String(change.reason||''),field:String(change.field||'period'),
    previous:change.previous??null,next:change.next??null,
    source:String(rec.source||'')});
  }
 }
 return lines.sort((a,b)=>b.date.localeCompare(a.date)||a.employee.localeCompare(b.employee,'ru'));
}
