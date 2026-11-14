import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareLosslessMigration,verifyLosslessMigration} from '../src/losslessMigrationV2.js';

test('Raw rows and extra vacation fields survive',()=>{
 const source=[{id:1,driverId:7,start:'2027-01-10',end:'2027-01-20',group:'9.1',parts:2,custom:{a:1}}];
 const result=prepareLosslessMigration({working2027:source,staff:[{id:7,name:'Тест'}],charts:[{id:'c',groupMinimums:{'9.1':2}}]});
 assert.equal(verifyLosslessMigration(result),true);
 assert.deepEqual(result.retainedSourceRows[0].raw,source[0]);
 assert.equal(result.originalSources.grotVacationCharts[0].groupMinimums['9.1'],2);
 result.retainedSourceRows[0].raw.custom.a=99;
 assert.equal(source[0].custom.a,1);
});
test('Invalid dates are preserved, flagged and prevent activation',()=>{
 const result=prepareLosslessMigration({history:[{year:2026,driver:'Тест',start:'2026-02-30',end:'2026-03-05',note:'do not lose'}]});
 assert.equal(result.readyForActivation,false);
 assert.equal(result.counts.originalVacationRows,1);
 assert.equal(result.counts.convertedVacationRows,0);
 assert.equal(result.unconvertedRows[0].raw.note,'do not lose');
 assert.equal(verifyLosslessMigration(result),true);
});
test('Ambiguous staff prevents activation while preserving rows',()=>{
 const result=prepareLosslessMigration({history:[{year:2026,driver:'Иванов',start:'2026-05-01',end:'2026-05-10'}]});
 assert.equal(result.readyForActivation,false);
 assert.equal(result.retainedSourceRows.length,1);
});
