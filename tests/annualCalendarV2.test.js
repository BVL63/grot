import test from 'node:test';
import assert from 'node:assert/strict';
import {annualCalendarModel,renderAnnualCalendarTable} from '../src/annualCalendarV2.js';

const mkPeriod=(year,staffId,start,end)=>({staffId,start:year+'-'+start,end:year+'-'+end});
test('calendar has identical table structure for 2026, 2027 and 2028',()=>{
 for(const year of [2026,2027,2028]){
  const model=annualCalendarModel(year,{staff:[{id:1,name:'Иванов Иван'}],periods:[mkPeriod(year,1,'07-01','07-10')]});
  const html=renderAnnualCalendarTable(model);
  assert.match(html,/class="annual-table"/);
  assert.match(html,/Состав/);
  assert.match(html,/Приор\./);
  assert.match(html,/Группа/);
  assert.match(html,/План/);
  assert.match(html,/Дост\./);
  assert.match(html,/Ост\./);
  assert.equal(model.rows[0].leaveDays,10);
  assert.equal(model.rows[0].monthly[6],10);
  assert.match(html,new RegExp('data-grot-year="'+year+'"'));
 }
});
test('2028 leap day is displayed and counted',()=>{
 const model=annualCalendarModel(2028,{staff:[{id:2,name:'Петров'}],periods:[mkPeriod(2028,2,'02-28','03-01')]});
 assert.equal(model.months[1].daysInMonth,29);
 assert.equal(model.rows[0].leaveDays,3);
 assert.match(renderAnnualCalendarTable(model,{expandedMonths:[2]}),/29/);
 assert.throws(()=>annualCalendarModel(2027,{periods:[mkPeriod(2027,2,'02-29','03-01')]}),/Некорректные/);
});
test('holidays excluded from leave day count but date remains in calendar',()=>{
 const model=annualCalendarModel(2027,{staff:[{id:1,name:'A'}],periods:[mkPeriod(2027,1,'01-01','01-03')],holidays:['2027-01-01'],calendarOverrides:{'2027-01-02':'holiday'}});
 assert.equal(model.rows[0].days.length,3);
 assert.equal(model.rows[0].leaveDays,1);
 assert.equal(model.rows[0].monthly[0],1);
});
test('legacy surnames never merge by inferred employee identity',()=>{
 const model=annualCalendarModel(2026,{
  staff:[{id:1,name:'Иванов Иван'},{id:2,name:'Иванов Пётр'}],
  periods:[{driver:'Иванов',start:'2026-05-01',end:'2026-05-05'}]
 });
 assert.equal(model.rows.length,3);
 assert.equal(model.rows.find(x=>x.key==='legacy:Иванов').legacy,true);
 assert.equal(model.rows.find(x=>x.key==='id:1').leaveDays,0);
});
test('two overlapping periods count unique days',()=>{
 const model=annualCalendarModel(2028,{staff:[{id:1,name:'Бахметьев'}],periods:[mkPeriod(2028,1,'08-01','08-05'),mkPeriod(2028,1,'08-04','08-10')]});
 assert.equal(model.rows[0].leaveDays,10);
 assert.equal(model.periodCount,2);
});
test('renderer escapes employee-controlled labels',()=>{
 const model=annualCalendarModel(2028,{staff:[{id:1,name:'<script>alert(1)</script>',group:'<img>'}]});
 const html=renderAnnualCalendarTable(model);
 assert.ok(!html.includes('<script>'));
 assert.ok(!html.includes('<img>'));
 assert.ok(html.includes('&lt;script&gt;'));
});
test('reading model does not mutate source records',()=>{
 const periods=[mkPeriod(2028,1,'01-09','01-12')];
 const staff=[{id:1,name:'Водитель'}];
 const original=JSON.stringify({periods,staff});
 annualCalendarModel(2028,{periods,staff});
 assert.equal(JSON.stringify({periods,staff}),original);
});
