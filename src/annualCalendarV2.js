/**
 * ГРОТ 2.0 — shared calendar view model for any year.
 * It has no browser dependencies, never writes storage and never assigns
 * a surname-only legacy record to a person without an explicit ID.
 */
const dateRe=/^\d{4}-\d{2}-\d{2}$/;
const validYear=year=>{
 const y=Number(year);
 if(!Number.isInteger(y)||y<2000||y>2200)throw new RangeError('Неверный год графика');
 return y;
};
const validDate=(date,year)=>{
 if(typeof date!=='string'||!dateRe.test(date)||Number(date.slice(0,4))!==year)return false;
 const v=new Date(date+'T12:00:00Z');
 return !Number.isNaN(v.getTime())&&v.toISOString().slice(0,10)===date;
};
const addDay=d=>{
 const next=new Date(d+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);
 return next.toISOString().slice(0,10);
};
const personLabel=p=>String(p.name||[p.lastName,p.firstName,p.middleName].filter(Boolean).join(' ')||'').trim();
const text=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const shortYearDate=d=>d.slice(8,10)+'.'+d.slice(5,7)+'.'+d.slice(2,4);

/**
 * @param {number} year
 * @param {Object} data
 * @param {Array} data.staff - staff with stable IDs
 * @param {Array} data.periods - records with staffId/driverId OR explicit legacy name
 * @param {Object} data.groups - groups by stable ID
 * @param {Object} data.calendarOverrides - dates marked holiday/weekend/workday
 * @param {Array} data.holidays - optional public holidays
 */
export function annualCalendarModel(year,{staff=[],periods=[],groups={},calendarOverrides={},holidays=[]}={}){
 const y=validYear(year);
 if(!Array.isArray(staff)||!Array.isArray(periods))throw new TypeError('Неверные данные графика');
 const staffItems=staff.map(p=>{
  if(!p||p.id===undefined||p.id===null)throw new Error('У сотрудника отсутствует ID');
  return {key:'id:'+String(p.id),staffId:p.id,name:personLabel(p),group:String(groups[String(p.id)]??p.group??'')};
 });
 const rows=new Map(staffItems.map(p=>[p.key,{...p,periods:[],days:new Set(),leaveDays:0}]));
 const uniqueNames=new Map();
 for(const p of staffItems){
  const key=p.name.toLocaleLowerCase('ru').replace(/ё/g,'е');
  if(!uniqueNames.has(key))uniqueNames.set(key,[]);
  uniqueNames.get(key).push(p.key);
 }
 const holidaySet=new Set(holidays.filter(d=>validDate(d,y)));
 const isHoliday=d=>calendarOverrides[d]==='holiday'||(calendarOverrides[d]===undefined&&holidaySet.has(d));
 const legacyName=(p)=>String(p.driver??p.staffName??'').trim();
 for(const p of periods){
  if(!p||!validDate(p.start,y)||!validDate(p.end,y)||p.end<p.start)throw new Error('Некорректные даты отпуска '+y+' года');
  const id=p.staffId??p.driverId;
  // Never infer identity by surname. Legacy records remain separate rows.
  const key=id!==undefined&&id!==null&&rows.has('id:'+String(id))?'id:'+String(id):'legacy:'+legacyName(p);
  if(key==='legacy:')throw new Error('Период без сотрудника или архивной фамилии');
  if(!rows.has(key)){
   const name=legacyName(p)||(id!==undefined?'ID '+String(id):'Неизвестный сотрудник');
   rows.set(key,{key,staffId:null,name,group:'',periods:[],days:new Set(),leaveDays:0,legacy:true});
  }
  rows.get(key).periods.push({...p});
  for(let day=p.start,n=0;day<=p.end&&n<367;day=addDay(day),n++)rows.get(key).days.add(day);
 }
 const totals=Array(12).fill(0),dailyCounts=new Map();
 const result=[...rows.values()].map(row=>{
  row.periods.sort((a,b)=>a.start.localeCompare(b.start));
  const monthly=Array(12).fill(0);
  for(const day of row.days){
   if(!isHoliday(day)){row.leaveDays++;monthly[Number(day.slice(5,7))-1]++;}
   dailyCounts.set(day,(dailyCounts.get(day)||0)+1);
  }
  for(let m=0;m<12;m++)totals[m]+=monthly[m];
  return {
   key:row.key,staffId:row.staffId,name:row.name,group:row.group,
   legacy:Boolean(row.legacy),periods:row.periods,days:[...row.days].sort(),
   monthly,leaveDays:row.leaveDays
  };
 });
 result.sort((a,b)=>a.group.localeCompare(b.group,'ru',{numeric:true})||a.name.localeCompare(b.name,'ru'));
 const months=Array.from({length:12},(_,i)=>({
  month:i+1,daysInMonth:new Date(Date.UTC(y,i+1,0)).getUTCDate(),
  leaveDays:totals[i],
  headcountByDay:Array.from({length:new Date(Date.UTC(y,i+1,0)).getUTCDate()},(_,day)=>{
   const iso=y+'-'+String(i+1).padStart(2,'0')+'-'+String(day+1).padStart(2,'0');
   return {date:iso,headcount:dailyCounts.get(iso)||0,holiday:isHoliday(iso)};
  })
 }));
 return {year:y,rows:result,months,periodCount:periods.length};
}

/**
 * One renderer for read-only calendar snapshots for all years. Editing controls
 * will be attached through the same model in a subsequent phase.
 */
export function renderAnnualCalendarTable(model,{expandedMonths=[]}={}){
 const expanded=new Set(expandedMonths.map(Number));
 const headers=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
 const cols=model.months.flatMap(m=>expanded.has(m.month)?m.headcountByDay.map((d,i)=>({month:m.month,day:i+1,date:d.date})):[{month:m.month,day:0,date:null}]);
 const monthsHead=model.months.map((m,i)=>'<th class="month-heading" colspan="'+(expanded.has(m.month)?m.daysInMonth:1)+'"><button type="button" data-v2-month="'+m.month+'">'+headers[i]+'</button></th>').join('');
 const dayHead=cols.map(c=>'<th class="'+(c.day?'day-heading':'month-placeholder')+'">'+(c.day?c.day:'')+'</th>').join('');
 const body=model.rows.map(row=>{
  const dates=new Set(row.days);
  const cells=cols.map(c=>{
   if(c.day)return '<td class="day '+(dates.has(c.date)?'vacation':'')+'">'+(dates.has(c.date)?'●':'')+'</td>';
   const n=row.monthly[c.month-1];
   return '<td class="month-cell '+(n?'has-vacation':'')+'">'+(n||'')+'</td>';
  }).join('');
  return '<tr data-v2-person="'+text(row.key)+'"><th class="fixed name">'+text(row.name)+'</th><td></td><td class="fixed group">'+text(row.group||'—')+'</td>'+cells+
   '<td class="annual-total">'+(row.leaveDays||'')+'</td><td></td><td></td></tr>';
 }).join('');
 const foot=cols.map(c=>{
  if(c.day){
   const day=model.months[c.month-1].headcountByDay[c.day-1];
   return '<td>'+(day.headcount||'')+'</td>';
  }
  const m=model.months[c.month-1];
  return '<td>'+m.headcountByDay.reduce((max,d)=>Math.max(max,d.headcount),0)+'</td>';
 }).join('');
 return '<table class="annual-table" data-grot-year="'+model.year+'"><thead><tr><th class="fixed name">Состав</th><th>Приор.</th><th class="fixed group">Группа</th>'+monthsHead+'<th rowspan="2">План</th><th rowspan="2">Дост.</th><th rowspan="2">Ост.</th></tr>'+
  '<tr class="calendar-days-row"><th class="fixed name"></th><th></th><th class="fixed group"></th>'+dayHead+'</tr></thead>'+
  '<tbody>'+body+'</tbody><tfoot><tr><th class="fixed name">В отпуске</th><td></td><td class="fixed group"></td>'+foot+'<td></td><td></td><td></td></tr></tfoot></table>';
}
