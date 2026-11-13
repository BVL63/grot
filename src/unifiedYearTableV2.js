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
export function renderUnifiedYearTable(view){
 const header=view.months.map(m=>'<th>'+esc(m)+'</th>').join('');
 const body=view.rows.map(row=>'<tr><th scope="row">'+esc(row.name)+'</th>'+row.months.map(parts=>
  '<td>'+parts.map(p=>'<div class="vacation-period" data-period-id="'+esc(p.id)+'">'+
  dateText(p.from)+' – '+dateText(p.to)+'<div>'+p.days+' дн.</div></div>').join('')+'</td>'
 ).join('')+'</tr>').join('');
 return '<table class="annual-table grot-unified-year"><thead><tr><th>Сотрудник</th>'+header+
 '</tr></thead><tbody>'+body+'</tbody></table>';
}
