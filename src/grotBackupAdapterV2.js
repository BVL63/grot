/**
 * Read-only import adapter for the REAL GROT backup (format:grot-backup).
 * Keeps the exact uploaded object as sourceSnapshot. NEVER writes to browser storage.
 */
import {makeDateRange} from './vacationModelV2.js';
const clone=x=>JSON.parse(JSON.stringify(x));
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const nameOf=s=>String(s?.name||[s?.lastName,s?.firstName,s?.middleName].filter(Boolean).join(' ')).trim();
const matchName=(name,staff)=>{
 const norm=x=>String(x||'').trim().toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/\s+/g,' ');
 const matches=staff.filter(s=>norm(nameOf(s))===norm(name));
 return matches.length===1?matches[0]:null;
};
export function inspectGrotBackup(data){
 if(!obj(data)||data.format!=='grot-backup'||![1,2].includes(data.version)||Number(data.year)!==2027)
  throw new Error('Не распознана резервная копия ГРОТ 2027');
 if(!Array.isArray(data.staff)||!Array.isArray(data.vacations))
  throw new Error('В резервной копии отсутствуют сотрудники или отпуска');
 const warnings=[],issues=[],records=[],staff=clone(data.staff);
 const staffIds=new Set(),known=new Map();
 staff.forEach((s,i)=>{
  if(!obj(s)||s.id==null||!nameOf(s))issues.push('Сотрудник №'+(i+1)+': нет ID или ФИО');
  else{
   const key=String(s.id);
   if(staffIds.has(key))issues.push('Повтор ID сотрудника: '+key);
   staffIds.add(key);known.set(key,s);
  }
 });
 const add=(row,index,source,year,employee,chartId)=>{
  if(!obj(row)){issues.push(source+' №'+(index+1)+': не объект');return;}
  let period;
  try{period={...makeDateRange(row.start,row.end,year)}}
  catch{issues.push(source+' №'+(index+1)+': неправильные даты');return;}
  const id=source+':'+index;
  records.push({
   id,year,chartId:chartId??null,
   staffId:employee?.id==null?null:String(employee.id),
   staffName:employee?nameOf(employee):String(row.driver||row.staffName||''),
   period,source,sourceIndex:index,audit:[],
   original:clone(row)
  });
 };
 data.vacations.forEach((p,i)=>{
  const employee=known.get(String(p?.driverId));
  if(!employee)issues.push('Отпуск 2027 №'+(i+1)+': сотрудник не найден');
  add(p,i,'vacations2027',2027,employee,'legacy-2027');
 });
 const hist=Array.isArray(data.seasonalityHistory)?data.seasonalityHistory:[];
 if(data.version===2&&!Array.isArray(data.seasonalityHistory))
  issues.push('В резервной копии отсутствует массив истории отпусков');
 hist.forEach((p,i)=>{
  const year=Number(p?.year??String(p?.start||'').slice(0,4));
  const employee=matchName(p?.driver,staff);
  if(!employee)warnings.push('Архив №'+(i+1)+': требуется сверить сотрудника '+String(p?.driver||''));
  add(p,i,'grot-seasonality-history-v1',year,employee,null);
 });
 const annual=obj(data.annualPlans)?clone(data.annualPlans):{};
 if(data.annualPlans!==undefined&&!obj(data.annualPlans))
  issues.push('Поле annualPlans имеет неверный формат');
 // Annual plans may be objects with independent periods. Preserve entire tree verbatim.
 for(const [key,plan] of Object.entries(annual)){
  if(!obj(plan)){issues.push('План '+key+': неправильный формат');continue;}
  const year=Number(plan.year||key);
  if(!Number.isInteger(year)||year<2000||year>2200){issues.push('План '+key+': неверный год');continue;}
  if(!Array.isArray(plan.periods)){issues.push('План '+key+': отсутствует массив periods');continue;}
  plan.periods.forEach((p,i)=>{
   const employee=known.get(String(p?.driverId))||matchName(p?.driver,staff);
   if(!employee)warnings.push('План '+year+' №'+(i+1)+': сотрудник не сопоставлен');
   add(p,i,'annualPlans/'+key,year,employee,p?.chartId??null);
  });
 }
 const expected=data.vacations.length+hist.length+
  Object.values(annual).reduce((n,p)=>n+(Array.isArray(p?.periods)?p.periods.length:0),0);
 if(records.length!==expected)issues.push('Преобразовано '+records.length+' из '+expected+' периодов');
 const original=clone(data);
 return {
  ok:issues.length===0,
  type:'grot-backup',
  records,staff,
  sourceSnapshot:original,
  warnings,problems:issues,
  counts:{
   original:expected,converted:records.length,
   staff:staff.length,
   charts:Array.isArray(data.charts)?data.charts.length:0,
   structure:Array.isArray(data.structure)?data.structure.length:0,
   historical:hist.length,
   annualYears:Object.keys(annual).length
  }
 };
}
