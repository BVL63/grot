/**
 * ГРОТ 2.0. Отдельная сверка встроенной истории 2026 с составом резервной копии.
 * Никаких изменений исходной копии или автоматического переноса в records.
 * Фамилия используется только если она однозначно соответствует сотруднику.
 */
import {historical2026} from './history2026.js';
import {makeDateRange} from './vacationModelV2.js';

const normalize=v=>String(v||'').trim().toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/\s+/g,' ');
const surnameOf=p=>String(p?.lastName||p?.name||'').trim().split(/\s+/)[0];

export function inspectBundledHistory2026(staff=[]){
 if(!Array.isArray(staff))throw new TypeError('Не найден справочник сотрудников');
 const matches=[],warnings=[];
 historical2026.forEach((row,index)=>{
  const candidates=staff.filter(p=>normalize(surnameOf(p))===normalize(row.driver));
  let period;
  try{period={...makeDateRange(row.start,row.end,2026)};}
  catch{warnings.push('Встроенная история №'+(index+1)+': некорректная дата');return;}
  if(candidates.length!==1){
   warnings.push('Встроенная история №'+(index+1)+': фамилия «'+row.driver+
    '» соответствует '+candidates.length+' сотрудникам');
  }
  matches.push({
   id:'bundled-history-2026:'+index,
   source:'src/history2026.js',sourceIndex:index,year:2026,chartId:null,
   staffId:candidates.length===1?String(candidates[0].id):null,
   staffName:candidates.length===1?String(candidates[0].name):row.driver,
   period,original:{...row},audit:[],
   requiresReview:candidates.length!==1,
   dismissed:candidates.length===1?Boolean(candidates[0].dismissed):null
  });
 });
 return {
  source:'src/history2026.js',total:historical2026.length,
  matched:matches.filter(r=>!r.requiresReview).length,
  unresolved:matches.filter(r=>r.requiresReview).length,
  records:matches,warnings,
  note:'Встроенная история не входит в резервную копию. Сверка не подтверждает, что это окончательные фактические даты.'
 };
}
