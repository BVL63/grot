import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectBundledHistory2026} from '../src/bundledHistoryReviewV2.js';
test('Встроенная история проверяется без изменения исходных записей',()=>{
 const data=[{id:4,lastName:'Бахметьев',name:'Бахметьев В.Л.'}];
 const report=inspectBundledHistory2026(data);
 assert.equal(report.total,26);
 assert.equal(report.matched,4);
 assert.equal(report.unresolved,22);
 assert.equal(report.records.length,26);
 assert.deepEqual(report.records[0].period,{start:'2026-03-16',end:'2026-03-26'});
 assert.equal(report.records[0].staffId,'4');
 assert.equal(data[0].lastName,'Бахметьев');
});
test('Два сотрудника с одной фамилией не сопоставляются автоматически',()=>{
 const staff=[{id:4,lastName:'Бахметьев',name:'Бахметьев А.'},
              {id:5,lastName:'Бахметьев',name:'Бахметьев Б.'}];
 const report=inspectBundledHistory2026(staff);
 assert.equal(report.records[0].staffId,null);
 assert.equal(report.records[0].requiresReview,true);
});
test('Уволенный сотрудник остаётся в истории',()=>{
 const staff=[{id:14,lastName:'Ломов',name:'Ломов В.В.',dismissed:true}];
 const report=inspectBundledHistory2026(staff);
 const row=report.records.find(r=>r.original.driver==='Ломов');
 assert.equal(row.staffId,'14');
 assert.equal(row.dismissed,true);
});
