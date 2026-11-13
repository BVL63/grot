import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDateRange, previewLegacyMigration, setFact} from '../src/vacationModelV2.js';

test('Корректная дата и переход на следующий год',()=>{
  assert.deepEqual({...makeDateRange('2027-12-20','2028-01-10',2027)},
    {start:'2027-12-20',end:'2028-01-10'});
  assert.throws(()=>makeDateRange('2027-02-30','2027-03-01',2027),RangeError);
});

test('План 2027 не становится фактом',()=>{
  const initial=[{id:8,driverId:'10',start:'2027-06-01',end:'2027-06-15'}];
  const result=previewLegacyMigration({working2027:initial});
  assert.equal(result.records[0].plan.start,'2027-06-01');
  assert.equal(result.records[0].fact,null);
  assert.equal(result.records[0].unclassified,null);
  assert.equal(initial[0].fact,undefined);
});

test('Неоднозначная история не превращается ни в план, ни в факт',()=>{
  const result=previewLegacyMigration({history:[
    {year:2026,driver:'Иванов',start:'2026-05-01',end:'2026-05-14'}
  ]});
  assert.equal(result.records[0].plan,null);
  assert.equal(result.records[0].fact,null);
  assert.equal(result.records[0].unclassified.start,'2026-05-01');
});

test('Разные годы независимы, дубли имеют разные идентификаторы',()=>{
  const result=previewLegacyMigration({history:[
    {year:2025,driver:'Иванов',start:'2025-06-01',end:'2025-06-10'},
    {year:2026,driver:'Иванов',start:'2026-06-01',end:'2026-06-10'}
  ]});
  assert.notEqual(result.records[0].id,result.records[1].id);
  assert.deepEqual(result.records.map(r=>r.year),[2025,2026]);
});

test('Факт записывается отдельно с аудитом, исходная запись не меняется',()=>{
  const original=previewLegacyMigration({working2027:[
    {driverId:1,start:'2027-07-01',end:'2027-07-14'}
  ]}).records[0];
  const next=setFact(original,{start:'2027-08-01',end:'2027-08-14'},
    {actor:'test-user',reason:'Документ кадровой службы',at:'2027-08-20T09:00:00Z'});
  assert.equal(original.fact,null);
  assert.equal(next.plan.start,'2027-07-01');
  assert.equal(next.fact.start,'2027-08-01');
  assert.equal(next.audit.length,1);
  assert.throws(()=>setFact(original,{start:'2027-08-01',end:'2027-08-14'}));
});
