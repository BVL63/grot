import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectGrotBackup} from '../src/grotBackupAdapterV2.js';
import {inspectPreviewImport} from '../src/previewImportV2.js';

const backup={
 format:'grot-backup',version:2,year:2027,createdAt:'2026-11-14T00:00:00Z',
 staff:[{id:7,name:'Иванов Иван',allowance:36,group:'9.1'}],
 vacations:[{driverId:7,start:'2027-06-01',end:'2027-06-14',extra:'retain'}],
 organization:{shortName:'Поликлиника'},structure:[{id:'a',type:'department'}],
 charts:[{id:'c',name:'Водители',staffIds:[7],groupMinimums:{'9.1':2}}],
 calendarOverrides:{},priorities:{},positions:[],activeChartId:'c',
 seasonalityHistory:[{year:2026,driver:'Иванов Иван',start:'2026-08-01',end:'2026-08-14'}],
 annualPlans:{2028:{year:2028,periods:[{driverId:7,start:'2028-07-01',end:'2028-07-14'}],charts:[]}}
};
test('Реальный формат резервной копии распознаётся и сохраняет все годы',()=>{
 const res=inspectPreviewImport(backup);
 assert.equal(res.ok,true);
 assert.equal(res.type,'grot-backup');
 assert.deepEqual(res.records.map(x=>x.year),[2027,2026,2028]);
 assert.equal(res.counts.original,3);
 assert.equal(res.counts.converted,3);
 assert.equal(res.counts.charts,1);
 assert.equal(res.sourceSnapshot.charts[0].groupMinimums['9.1'],2);
 res.records[0].period.start='2027-06-02';
 assert.equal(backup.vacations[0].start,'2027-06-01');
 assert.equal(res.sourceSnapshot.vacations[0].extra,'retain');
});
test('Некорректные даты не пропадают без предупреждения',()=>{
 const bad=structuredClone(backup);
 bad.vacations[0].start='2027-02-30';
 const res=inspectGrotBackup(bad);
 assert.equal(res.ok,false);
 assert.equal(res.counts.original,3);
 assert.equal(res.counts.converted,2);
 assert.ok(res.problems.length>0);
 assert.equal(res.sourceSnapshot.vacations.length,1);
});
test('Резервная копия не соответствует другим форматам',()=>{
 assert.throws(()=>inspectGrotBackup({format:'grot-backup',year:2027,version:9}));
});

test('Пустая архивная история явно отмечается, структура проверяется',()=>{
 const copy=structuredClone(backup);
 copy.seasonalityHistory=[];
 copy.annualPlans={};
 copy.charts[0].structureIds=['missing-node'];
 const res=inspectGrotBackup(copy);
 assert.equal(res.ok,true);
 assert.equal(res.counts.original,1);
 assert.equal(res.counts.bundledHistory2026Available,26);
 assert.ok(res.warnings.some(w=>w.includes('встроены 26 периодов 2026')));
 assert.ok(res.warnings.some(w=>w.includes('отсутствует элемент структуры')));
 assert.ok(res.warnings.some(w=>w.includes('будущих годов')));
 assert.equal(res.sourceSnapshot.charts[0].structureIds[0],'missing-node');
});
