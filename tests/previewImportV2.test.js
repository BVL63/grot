import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectPreviewImport} from '../src/previewImportV2.js';

test('valid preview rows and untouched source copy',()=>{
 const data={staff:[{id:1,name:'Иванов'}],records:[{id:'one',year:2027,staffId:1,period:{start:'2027-01-01',end:'2027-01-10'}}]};
 const result=inspectPreviewImport(data);
 assert.equal(result.ok,true);
 assert.equal(result.counts.original,1);
 result.records[0].period.start='2027-01-02';
 assert.equal(result.sourceSnapshot.records[0].period.start,'2027-01-01');
 assert.equal(data.records[0].period.start,'2027-01-01');
});
test('invalid or duplicate records block loading',()=>{
 const a={id:'a',year:2027,period:{start:'2027-02-30',end:'2027-03-01'}};
 const result=inspectPreviewImport({staff:[],records:[a,{...a}]});
 assert.equal(result.ok,false);
 assert.equal(result.counts.converted,0);
});
test('legacy invalid record is not silently discarded',()=>{
 const result=inspectPreviewImport({working2027:[],history:[{year:2026,driver:'Иванов',start:'2026-02-30',end:'2026-03-02'}],staff:[]});
 assert.equal(result.ok,false);
 assert.equal(result.counts.original,1);
 assert.equal(result.counts.converted,0);
});
test('unknown backup format is rejected',()=>{
 const result=inspectPreviewImport({vacations2027:[]});
 assert.equal(result.ok,false);
});
