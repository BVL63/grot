import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDateRange,previewLegacyMigration,revisePeriod} from '../src/vacationModelV2.js';

test('Дата и переход на следующий год',()=>{
 assert.deepEqual({...makeDateRange('2027-12-20','2028-01-10',2027)},{start:'2027-12-20',end:'2028-01-10'});
 assert.throws(()=>makeDateRange('2027-02-30','2027-03-01',2027),RangeError);
});
test('В каждом году только один период, без отдельного факта',()=>{
 const result=previewLegacyMigration({working2027:[{start:'2027-06-01',end:'2027-06-15'}],history:[
  {year:2026,driver:'Иванов',start:'2026-05-01',end:'2026-05-14'}]});
 assert.equal(result.records.length,2);
 assert.equal(result.records[0].period.start,'2027-06-01');
 assert.equal(result.records[1].period.start,'2026-05-01');
 assert.ok(!('fact' in result.records[0]));
 assert.ok(!('plan' in result.records[0]));
});
test('Годы и записи независимы',()=>{
 const result=previewLegacyMigration({history:[
  {year:2025,driver:'Иванов',start:'2025-06-01',end:'2025-06-10'},
  {year:2026,driver:'Иванов',start:'2026-06-01',end:'2026-06-10'}]});
 assert.notEqual(result.records[0].id,result.records[1].id);
});
test('Корректировка не уничтожает прежние даты',()=>{
 const source=previewLegacyMigration({working2027:[{start:'2027-07-01',end:'2027-07-14'}]}).records[0];
 const updated=revisePeriod(source,{start:'2027-08-01',end:'2027-08-14'},
  {actor:'user',reason:'Исправление графика',at:'2027-01-01T00:00:00Z'});
 assert.equal(source.period.start,'2027-07-01');
 assert.equal(updated.period.start,'2027-08-01');
 assert.equal(updated.audit[0].previous.start,'2027-07-01');
 assert.throws(()=>revisePeriod(source,{start:'2027-08-01',end:'2027-08-14'}));
});
