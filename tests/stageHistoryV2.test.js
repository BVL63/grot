import test from 'node:test';
import assert from 'node:assert/strict';
import {stageBundledHistory} from '../src/stageHistoryV2.js';
const item={id:'bundled-history-2026:0',year:2026,staffId:'4',staffName:'Бахметьев',period:{start:'2026-03-16',end:'2026-03-26'},source:'src/history2026.js',audit:[],requiresReview:false};
test('История попадает только в возвращаемую копию и помечается как непроверенная',()=>{
 const source=[{id:'2027-period',year:2027,staffId:'4',period:{start:'2027-01-01',end:'2027-01-10'}}];
 const result=stageBundledHistory(source,{records:[item]});
 assert.equal(source.length,1);
 assert.equal(result.counts.added,1);
 assert.equal(result.records[1].verificationStatus,'unverified-source');
 assert.equal(result.records[1].requiresReview,true);
 assert.equal(result.records[1].period.start,'2026-03-16');
});
test('Повторное добавление не создаёт дубликаты',()=>{
 const first=stageBundledHistory([],{records:[item]});
 const second=stageBundledHistory(first.records,{records:[item]});
 assert.equal(second.counts.added,0);
 assert.equal(second.counts.duplicates,1);
 assert.equal(second.records.length,1);
});
test('Неоднозначное совпадение и пересечение запрещены',()=>{
 const unresolved={...item,staffId:null,requiresReview:true};
 assert.equal(stageBundledHistory([],{records:[unresolved]}).counts.unresolved,1);
 assert.throws(()=>stageBundledHistory([{...item,id:'other',period:{start:'2026-03-20',end:'2026-04-01'}}],{records:[item]}),/пересечение/);
});

test('После редактирования года повторное добавление не возвращает старые даты',()=>{
 const first=stageBundledHistory([],{records:[item]});
 const changed=first.records.map(r=>({...r,period:{start:'2026-04-01',end:'2026-04-10'}}));
 const second=stageBundledHistory(changed,{records:[item]});
 assert.equal(second.counts.added,0);
 assert.equal(second.counts.duplicates,1);
 assert.equal(second.records[0].period.start,'2026-04-01');
});
