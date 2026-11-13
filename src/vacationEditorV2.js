/**
 * ГРОТ 2.0 — контроллер редактора одного отпускного периода.
 * Без доступа к базе данных и localStorage; возвращает новую коллекцию.
 * Интерфейс и транспорт сохраняют результат только после проверки.
 */
import {makeDateRange,revisePeriod} from './vacationModelV2.js';

function requireAccess(policy){
 if(!policy || policy.readOnly || !(policy.canEditPlan || policy.canCorrect))
  throw new Error('Редактирование этого графика запрещено');
}
function requireAudit(meta){
 if(!meta || !String(meta.actor||'').trim() || !String(meta.reason||'').trim() || !String(meta.at||'').trim())
  throw new Error('Укажите пользователя, основание и время изменения');
}
const samePerson=(a,b)=>a.staffId!=null&&b.staffId!=null
 ? String(a.staffId)===String(b.staffId)
 : a.staffId==null&&b.staffId==null&&String(a.staffName||'')===String(b.staffName||'');
const overlap=(a,b)=>a.start<=b.end&&b.start<=a.end;
function validateNoOverlap(records,period,identity,excludeId=null){
 const conflicts=records.filter(r=>!r.deleted && String(r.id)!==String(excludeId) &&
   Number(r.year)===Number(identity.year) &&
   String(r.chartId??'')===String(identity.chartId??'') &&
   samePerson(r,identity) && r.period && overlap(r.period,period));
 if(conflicts.length)throw new Error('Отпуск пересекается с другим периодом этого сотрудника');
}
export function addVacationPeriod(records,draft,policy,meta){
 requireAccess(policy);
 requireAudit(meta);
 if(!Array.isArray(records))throw new TypeError('Нужен список отпусков');
 const year=Number(draft.year);
 if(Number(policy.year)!==year)throw new Error('Несовпадение года графика');
 if(draft.staffId==null&&!String(draft.staffName||'').trim())throw new Error('Не выбран сотрудник');
 if(draft.id==null||records.some(r=>String(r.id)===String(draft.id)))throw new Error('Неуникальный идентификатор');
 const period={...makeDateRange(draft.start,draft.end,year)};
 const record={
  id:String(draft.id),year,chartId:draft.chartId??null,
  staffId:draft.staffId==null?null:String(draft.staffId),
  staffName:String(draft.staffName||''),period,
  audit:[{field:'period',previous:null,next:{...period},actor:String(meta.actor),reason:String(meta.reason),at:String(meta.at)}]
 };
 validateNoOverlap(records,period,record);
 return [...records,record];
}
export function editVacationPeriod(records,id,dates,policy,meta){
 requireAccess(policy);
 requireAudit(meta);
 const index=records.findIndex(r=>String(r.id)===String(id));
 if(index<0)throw new Error('Период не найден');
 const current=records[index];
 if(Number(current.year)!==Number(policy.year))throw new Error('Несовпадение года графика');
 const period=makeDateRange(dates.start,dates.end,current.year);
 validateNoOverlap(records,period,current,current.id);
 const updated=revisePeriod(current,period,meta);
 return records.map((r,i)=>i===index?updated:r);
}
export function removeVacationPeriod(records,id,policy,meta){
 requireAccess(policy);
 requireAudit(meta);
 const record=records.find(r=>String(r.id)===String(id));
 if(!record)throw new Error('Период не найден');
 if(Number(record.year)!==Number(policy.year))throw new Error('Несовпадение года графика');
 // Soft-delete: maintain original data and audit history for recovery.
 return records.map(r=>String(r.id)!==String(id)?r:{
  ...r,deleted:true,
  audit:[...(r.audit||[]),{
   field:'deleted',previous:false,next:true,
   actor:String(meta.actor),reason:String(meta.reason),at:String(meta.at)
  }]
 });
}
