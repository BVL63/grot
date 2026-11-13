import test from 'node:test';
import assert from 'node:assert/strict';
import {createYearStore} from '../src/yearStoreV2.js';

function memoryStorage(initial={}){
 const values=new Map(Object.entries(initial));
 return {
  get length(){return values.size},
  key(i){return [...values.keys()][i]??null},
  getItem(k){return values.has(k)?values.get(k):null},
  setItem(k,v){values.set(String(k),String(v))},
  removeItem(k){values.delete(k)},
  snapshot(){return Object.fromEntries(values)}
 };
}
const record=(year,driverId)=>({driverId,start:year+'-07-01',end:year+'-07-14'});
test('reading 2026 and 2027 does not mutate legacy browser keys',()=>{
 const storage=memoryStorage({vacations2027:JSON.stringify([record(2027,1)]),'grot-seasonality-history-v1':JSON.stringify([{year:2026,driver:'Бахметьев',start:'2026-03-16',end:'2026-03-26'}])});
 const initial=storage.snapshot();
 const store=createYearStore(storage,{readLegacyYear:y=>({
  periods:y===2026?[{driver:'Бахметьев',start:'2026-03-16',end:'2026-03-26'}]:y===2027?[record(2027,1)]:[]
 })});
 assert.equal(store.readYear(2026).periods[0].driver,'Бахметьев');
 assert.equal(store.readYear(2027).periods[0].driverId,1);
 assert.deepEqual(storage.snapshot(),initial);
});
test('new year never copies vacation periods, and changes are isolated',()=>{
 const storage=memoryStorage({vacations2027:'untouched'});
 const store=createYearStore(storage,{readLegacyYear:y=>y===2027?{staffIds:[1,2],charts:[{id:'garage',year:2027,approval:{approvedAt:'2026-12-15'}}],periods:[record(2027,1)]}:null});
 const newYear=store.createYear(2028);
 assert.equal(newYear.periods.length,0);
 assert.equal(newYear.staffIds.length,2);
 assert.equal(newYear.charts[0].approval,null);
 assert.equal(newYear.charts[0].year,2028);
 store.writeYear(2028,{periods:[record(2028,2)]});
 assert.equal(store.readYear(2028).periods.length,1);
 assert.equal(store.readYear(2027).periods[0].start,'2027-07-01');
 assert.equal(storage.getItem('vacations2027'),'untouched');
 assert.throws(()=>store.createYear(2028),/существует/);
});
test('rejects wrong-year and impossible dates before writing',()=>{
 const storage=memoryStorage();
 const store=createYearStore(storage);
 assert.throws(()=>store.writeYear(2026,{periods:[record(2027,1)]}),/период/);
 assert.throws(()=>store.writeYear(2026,{periods:[{driverId:1,start:'2026-02-30',end:'2026-03-05'}]}),/период/);
 assert.throws(()=>store.writeYear(2026,{year:2027}),/другого года/);
 assert.deepEqual(store.listYears(),[]);
});
test('rejects broken data rather than silently replacing it',()=>{
 const storage=memoryStorage({'grot-year-v2:2028':'not-json','vacations2027':'original'});
 const store=createYearStore(storage);
 assert.throws(()=>store.readYear(2028),/повреждены/);
 assert.throws(()=>store.writeYear(2028,{periods:[]}),/повреждены/);
 assert.equal(storage.getItem('grot-year-v2:2028'),'not-json');
 assert.equal(storage.getItem('vacations2027'),'original');
});
test('read data cannot mutate persisted state',()=>{
 const storage=memoryStorage();
 const store=createYearStore(storage);
 store.writeYear(2029,{staffIds:[5],charts:[{id:'team',members:[5]}],periods:[]});
 const data=store.readYear(2029);
 data.staffIds.push(6);data.charts[0].members.push(6);
 assert.deepEqual(store.readYear(2029).staffIds,[5]);
 assert.deepEqual(store.readYear(2029).charts[0].members,[5]);
});
