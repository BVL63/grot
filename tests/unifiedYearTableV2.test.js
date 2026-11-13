import test from 'node:test';
import assert from 'node:assert/strict';
import {buildUnifiedYearView,renderUnifiedYearTable} from '../src/unifiedYearTableV2.js';

test('Единый интерфейс для 2025 и 2028',()=>{
 for(const year of [2025,2026,2027,2028]){
  const result=buildUnifiedYearView(year,[],[{id:1,name:'Бахметьев'}]);
  assert.equal(result.months.length,12);
  assert.equal(result.rows.length,1);
  assert.match(renderUnifiedYearTable(result),/Сотрудник/);
 }
});
test('Отпуск через границу месяцев отражается в обоих',()=>{
 const row={id:'p1',year:2027,staffId:1,period:{start:'2027-06-28',end:'2027-07-06'}};
 const v=buildUnifiedYearView(2027,[row],[{id:1,name:'Иванов'}]);
 assert.equal(v.rows[0].months[5][0].days,3);
 assert.equal(v.rows[0].months[6][0].days,6);
});
test('Пересечение года относится только к показанному году',()=>{
 const row={id:'p2',year:2027,staffId:1,period:{start:'2027-12-28',end:'2028-01-04'}};
 const v=buildUnifiedYearView(2027,[row],[{id:1,name:'Иванов'}]);
 assert.equal(v.rows[0].months[11][0].days,4);
 assert.equal(v.rows[0].months[0].length,0);
});
test('Отображение экранирует имена и идентификаторы',()=>{
 const v=buildUnifiedYearView(2027,[{id:'<x>',year:2027,staffName:'<img>',period:{start:'2027-01-01',end:'2027-01-03'}}]);
 const html=renderUnifiedYearTable(v);
 assert.ok(!html.includes('<img>'));
 assert.ok(html.includes('&lt;img&gt;'));
 assert.ok(html.includes('&lt;x&gt;'));
});
