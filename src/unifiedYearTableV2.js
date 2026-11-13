/**
 * ГРОТ 2.0: единая таблица для любого года.
 * Чистая функция для предварительного просмотра: не обращается к localStorage,
 * не меняет исходные данные и не предполагает «Факт».
 */
const MONTHS=['Январь','Февраль','Март','Апрель','Май','Июнь',
 'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const dateText=s=>s?String(s).slice(8,10)+'.'+String(s).slice(5,7)+'.'+String(s).slice(2,4):'';
function monthIntersections(record,year){
 const a=record.period?.start,b=record.period?.end;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(a||'')||!/^\d{4}-\d{2}-\d{2}$/.test(b||'')||b<a)return [];
 const first=new Date(a+'T12:00:00Z');
 const last=new Date(b+'T12:00:00Z');
 const items=[];
 for(let m=0;m<12;m++){
  const start=new Date(Date.UTC(year,m,1,12)),end=new Date(Date.UTC(year,m+1,0,12));
  if(first>end||last<start)continue;
  const from=new Date(Math.max(first,start)),to=new Date(Math.min(last,end));
  const days=Math.round((to-from)/86400000)+1;
  items.push({month:m,from:from.toISOString().slice(0,10),to:to.toISOString().slice(0,10),days});
 }
 return items;
}
export function buildUnifiedYearView(year,records=[],staff=[]){
 const y=Number(year);
 if(!Number.isInteger(y)||y<2000||y>2200)throw new RangeError('Некорректный год');
 const people=new Map();
 for(const employee of staff){
  const id=String(employee.id);
  if(!people.has(id))people.set(id,{id,name:employee.name||[employee.lastName,employee.firstName,employee.middleName].filter(Boolean).join(' '),periods:[],months:Array.from({length:12},()=>[])});
 }
 for(const r of records){
  if(Number(r.year)!==y)continue;
  const id=r.staffId==null?'unmatched:'+String(r.staffName||r.id):String(r.staffId);
  if(!people.has(id))people.set(id,{id,name:r.staffName||'Не установлен',periods:[],months:Array.from({length:12},()=>[])});
  const person=people.get(id);
  person.periods.push(r);
  for(const segment of monthIntersections(r,y))person.months[segment.month].push({...segment,id:r.id});
 }
 return {year:y,months:MONTHS,rows:[...people.values()].sort((a,b)=>a.name.localeCompare(b.name,'ru'))};
}
/**
 * На одном месяце даты располагаются вертикально.
 * Период через несколько месяцев показываем одной объединённой ячейкой,
 * только когда объединение не скрывает другой отпуск в тех же месяцах.
 */
const duration=(start,end)=>{
 const a=Date.parse(start+'T12:00:00Z'),b=Date.parse(end+'T12:00:00Z');
 return Number.isFinite(a)&&Number.isFinite(b)?Math.round((b-a)/86400000)+1:0;
};
function buildMonthCells(row){
 const used=Array.from({length:12},()=>[]);
 const reservations=new Set();
 const entries=[];
 for(const rec of row.periods){
  const all=monthIntersections(rec,Number(rec.year));
  if(!all.length)continue;
  const first=all[0].month,last=all[all.length-1].month;
  entries.push({rec,first,last,all,span:last-first+1});
 }
 // Сначала резервируем месяцы однозначных длинных периодов.
 entries.sort((a,b)=>b.span-a.span||a.first-b.first);
 for(const entry of entries){
  if(entry.span>1&&entry.all.every(m=>!reservations.has(m.month))&&
   !entries.some(other=>other!==entry&&other.all.some(m=>m.month>=entry.first&&m.month<=entry.last))){
   entry.merged=true;
   for(const m of entry.all)reservations.add(m.month);
  }
 }
 const blocks=Array.from({length:12},()=>[]);
 const mergedByStart=new Map();
 const occupied=new Set();
 for(const entry of entries){
  if(entry.merged){
   mergedByStart.set(entry.first,entry);
   for(const m of entry.all)occupied.add(m.month);
  }else for(const segment of entry.all)blocks[segment.month].push({rec:entry.rec,segment});
 }
 const cells=[];
 for(let m=0;m<12;){
  const merged=mergedByStart.get(m);
  if(merged){
   const d=duration(merged.rec.period.start,merged.rec.period.end);
   cells.push('<td colspan="'+merged.span+'" class="period-span"><button type="button" class="vacation-period multi-month" data-period-id="'+esc(merged.rec.id)+'">'+
    '<span>'+dateText(merged.rec.period.start)+' – '+dateText(merged.rec.period.end)+'</span><strong>'+d+' дн.</strong></button></td>');
   m+=merged.span;
  }else if(occupied.has(m)){
   // В реальном расписании этот месяц уже покрыт colspan.
   m++;
  }else{
   cells.push('<td>'+blocks[m].map(p=>'<button type="button" class="vacation-period single-month" data-period-id="'+esc(p.rec.id)+'">'+
    '<span>'+dateText(p.segment.from)+'</span><span>'+dateText(p.segment.to)+'</span>'+
    '<strong>'+duration(p.rec.period.start,p.rec.period.end)+' дн.</strong></button>').join('')+'</td>');
   m++;
  }
 }
 return cells.join('');
}
export function renderUnifiedYearTable(view){
 const header=view.months.map(m=>'<th>'+esc(m)+'</th>').join('');
 const body=view.rows.map(row=>'<tr><th scope="row">'+esc(row.name)+'</th>'+
  buildMonthCells(row)+'</tr>').join('');
 return '<table class="annual-table grot-unified-year"><thead><tr><th scope="col">Сотрудник</th>'+header+
 '</tr></thead><tbody>'+body+'</tbody></table>';
}
