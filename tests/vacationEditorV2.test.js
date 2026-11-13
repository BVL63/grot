import test from 'node:test';
import assert from 'node:assert/strict';
import {addVacationPeriod,editVacationPeriod,removeVacationPeriod} from '../src/vacationEditorV2.js';

const access={year:2027,readOnly:false,canEditPlan:true};
const meta={actor:'Администратор',reason:'Исправление дат',at:'2026-11-14T12:00:00Z'};
const base={id:'1',year:2027,chartId:'drivers',staffId:'7',staffName:'Иванов',
 period:{start:'2027-06-01',end:'2027-06-14'},audit:[]};

test('Изменение не затрагивает исходную запись и другие годы',()=>{
 const original=[base,{...base,id:'2',year:2026,period:{start:'2026-06-01',end:'2026-06-14'}}];
 const edited=editVacationPeriod(original,'1',{start:'2027-07-01',end:'2027-07-14'},access,meta);
 assert.equal(original[0].period.start,'2027-06-01');
 assert.equal(edited[0].period.start,'2027-07-01');
 assert.equal(edited[0].audit[0].previous.start,'2027-06-01');
 assert.deepEqual(edited[1],original[1]);
});
test('Права и пересечения проверяются',()=>{
 assert.throws(()=>editVacationPeriod([base],'1',{start:'2027-07-01',end:'2027-07-14'}, {...access,readOnly:true},meta));
 const other={...base,id:'3',period:{start:'2027-07-01',end:'2027-07-14'}};
 assert.throws(()=>editVacationPeriod([base,other],'1',{start:'2027-07-02',end:'2027-07-16'},access,meta),/пересекается/);
});
test('Добавление в 2028 не требует отдельных форм',()=>{
 const result=addVacationPeriod([],{id:'v28',year:2028,staffId:7,start:'2028-02-01',end:'2028-02-14'},
 {...access,year:2028},meta);
 assert.equal(result[0].year,2028);
 assert.equal(result[0].audit.length,1);
});
test('Удаление сохраняет запись и журнал',()=>{
 const result=removeVacationPeriod([base],'1',access,meta);
 assert.equal(result.length,1);
 assert.equal(result[0].deleted,true);
 assert.equal(result[0].audit[0].field,'deleted');
 assert.equal(base.deleted,undefined);
});
