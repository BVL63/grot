import test from 'node:test';
import assert from 'node:assert/strict';
import {queryVacationAudit} from '../src/v2AuditJournal.js';

const records=[
 {id:'r1',year:2026,staffName:'Бахметьев В.Л.',audit:[
  {at:'2026-11-14T00:01:00Z',actor:'Администратор',reason:'Исправление',previous:{start:'2026-03-16',end:'2026-03-26'},next:{start:'2026-03-16',end:'2026-03-25'}}]},
 {id:'r2',year:2027,staffName:'Иванов И.И.',audit:[]},
 {id:'r3',year:2026,staffName:'Бахметьев В.Л.',deleted:true,audit:[
  {at:'2026-11-14T00:02:00Z',actor:'Администратор',reason:'Удалён период',field:'deleted',previous:false,next:true}]}];
test('Журнал доступен отдельно с фильтром по году и ФИО',()=>{
 const result=queryVacationAudit(records,{year:2026,search:'бахметьев'});
 assert.equal(result.length,2);
 assert.equal(result[0].recordId,'r3');
 assert.equal(result[1].previous.end,'2026-03-26');
});
test('История удалённых периодов сохраняется в запросе',()=>{
 const result=queryVacationAudit(records,{year:2026});
 assert.ok(result.some(r=>r.field==='deleted'));
});
test('Запрос журнала не изменяет исходные периоды',()=>{
 const before=JSON.stringify(records);
 assert.equal(queryVacationAudit(records,{year:2027}).length,0);
 assert.equal(JSON.stringify(records),before);
});
