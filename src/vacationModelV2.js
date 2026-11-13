/**
 * ГРОТ 2.0: один редактируемый период отпуска для любого года.
 * Чистые функции не изменяют localStorage и не выполняют миграцию сами.
 */
const DATE_RE=/^\d{4}-\d{2}-\d{2}$/;
function validDate(value){
 if(typeof value!=='string'||!DATE_RE.test(value))return false;
 const [y,m,d]=value.split('-').map(Number);
 const dt=new Date(Date.UTC(y,m-1,d));
 return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d;
}
export function makeDateRange(start,end,year){
 const y=Number(year);
 if(!Number.isInteger(y)||y<2000||y>2200)throw new RangeError('Некорректный год');
 if(!validDate(start)||!validDate(end)||end<start||Number(start.slice(0,4))!==y)
  throw new RangeError('Некорректные даты отпускного периода');
 return Object.freeze({start,end});
}
const yearOf=row=>Number(row.year??String(row.start||'').slice(0,4));
const legacyName=row=>String(row.driver||row.staffName||'').trim();
/**
 * Просмотр переноса, без записи в хранилище. Исторические даты сохраняются
 * как текущий период; происхождение известно, фактичность не предполагается.
 */
export function previewLegacyMigration({working2027=[],history=[],staff=[]}={}){
 const records=[],warnings=[];
 const roster=Array.isArray(staff)?staff:[];
 const normalize=v=>String(v||'').trim().toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/\s+/g,' ');
 const matchPerson=name=>{
  const key=normalize(name);
  if(!key)return null;
  const matched=roster.filter(p=>normalize(p.name||[p.lastName,p.firstName,p.middleName].filter(Boolean).join(' '))===key);
  return matched.length===1?String(matched[0].id):null;
 };
 for(const [rows,source] of [[working2027,'vacations2027'],[history,'grot-seasonality-history-v1']]){
  if(!Array.isArray(rows)){warnings.push('Неверный источник: '+source);continue;}
  rows.forEach((row,index)=>{
   const year=source==='vacations2027'?2027:yearOf(row);
   let period;
   try{period={...makeDateRange(row.start,row.end,year)}}catch{
    warnings.push('Неверные даты: '+source+' №'+(index+1));return;
   }
   const staffId=row.driverId!=null?String(row.driverId):matchPerson(legacyName(row));
   if(staffId===null)warnings.push('Требуется сверка сотрудника: '+source+' №'+(index+1));
   records.push({
    id:source+':'+index,year,chartId:source==='vacations2027'?'legacy-2027':null,
    staffId,staffName:legacyName(row),source,sourceIndex:index,
    period,audit:[]
   });
  });
 }
 return {schemaVersion:2,records,warnings,sourceCounts:{
  working2027:Array.isArray(working2027)?working2027.length:0,
  history:Array.isArray(history)?history.length:0
 }};
}
/** Изменение периода с обязательным журналом. Старую запись не мутирует. */
export function revisePeriod(record,range,{actor,reason,at}={}){
 if(!actor||!reason||!at)throw new Error('Нужны пользователь, причина и время');
 const next={...makeDateRange(range.start,range.end,record.year)};
 const previous={...record.period};
 if(previous.start===next.start&&previous.end===next.end)return record;
 return {...record,period:next,audit:[...(record.audit||[]),{
  field:'period',previous,next,actor:String(actor),reason:String(reason),at:String(at)
 }]};
}
