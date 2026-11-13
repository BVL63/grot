import {inspectGrotBackup} from './grotBackupAdapterV2.js';
/**
 * ГРОТ 2.0 — проверка импорта только в память пробной страницы.
 * Никакой доступ к localStorage, никакая запись в рабочую базу.
 */
import {makeDateRange} from './vacationModelV2.js';
import {prepareLosslessMigration,verifyLosslessMigration} from './losslessMigrationV2.js';

const copy=value=>JSON.parse(JSON.stringify(value));
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function validRecord(r){
 if(!isObject(r)||r.id==null||r.period==null) return false;
 try{makeDateRange(r.period.start,r.period.end,r.year);return true;}catch{return false;}
}
export function inspectPreviewImport(data){
 if(!isObject(data))throw new Error('Файл должен содержать JSON-объект');
 if(data.format==='grot-backup')return inspectGrotBackup(data);
 if(Array.isArray(data.records)){
  if(!Array.isArray(data.staff))throw new Error('Для формата 2.0 требуется массив staff');
  const ids=new Set(),problems=[];
  data.records.forEach((r,i)=>{
   if(!validRecord(r))problems.push('Запись '+(i+1)+': неверный период или идентификатор');
   const key=String(r?.id);
   if(ids.has(key))problems.push('Запись '+(i+1)+': повторный ID');
   ids.add(key);
  });
  if(problems.length)return {ok:false,type:'v2',problems,counts:{original:data.records.length,converted:0}};
  return {ok:true,type:'v2',problems:[],counts:{original:data.records.length,converted:data.records.length},
   records:copy(data.records),staff:copy(data.staff),sourceSnapshot:copy(data)};
 }
 if(Array.isArray(data.working2027)&&Array.isArray(data.history) &&
    Array.isArray(data.staff)){
  const migration=prepareLosslessMigration({
   working2027:data.working2027,history:data.history,staff:data.staff,
   charts:Array.isArray(data.charts)?data.charts:[]
  });
  const problems=[...migration.preview.warnings];
  if(!verifyLosslessMigration(migration))problems.push('Не удалось сверить исходные записи');
  if(!migration.readyForActivation)problems.push('Есть записи, требующие ручной проверки');
  return {
   ok:problems.length===0,type:'legacy',problems,
   counts:{original:migration.counts.originalVacationRows,converted:migration.counts.convertedVacationRows},
   records:migration.preview.records,staff:copy(data.staff),
   sourceSnapshot:copy(data)
  };
 }
 return {ok:false,type:'unknown',problems:[
  'Формат резервной копии не распознан. Никакие данные не загружены.'
 ],counts:{original:0,converted:0}};
}
