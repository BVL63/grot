// ГРОТ: отчёт «Кадровая нагрузка» — прогноз по отпускам, не табель явки.
const months=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const dateISO=(month,day)=>'2027-'+String(month+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');
const monthDays=month=>new Date(Date.UTC(2027,month+1,0)).getUTCDate();
const groupValue=d=>String(d.group??'').trim();
const firstName=d=>{
 if(d.lastName)return d.lastName+' '+(d.firstName?d.firstName[0]+'.':'')+(d.middleName?d.middleName[0]+'.':'');
 return String(d.name||'');
};
function availableOn(d,date){
 if(d.hireDate&&d.hireDate>date)return false;
 if(d.dismissalDate&&d.dismissalDate<date)return false;
 return !(d.dismissed&&!d.dismissalDate);
}
function calculateDaily(staff,periods,dayType,month,group){
 const people=group==='*'?staff:staff.filter(d=>groupValue(d)===group);
 const periodById=new Map();
 for(const p of periods){
  const id=String(p.driverId);
  if(!periodById.has(id))periodById.set(id,[]);
  periodById.get(id).push(p);
 }
 const days=[];
 for(let day=1;day<=monthDays(month);day++){
  const date=dateISO(month,day),type=dayType(date),eligible=people.filter(d=>availableOn(d,date));
  const away=eligible.filter(d=>(periodById.get(String(d.id))||[]).some(p=>p.start<=date&&p.end>=date));
  days.push({date,day,type,total:eligible.length,away:away.length,working:eligible.length-away.length,availablePct:eligible.length?Math.round((eligible.length-away.length)*1000/eligible.length)/10:null,names:away.map(firstName).sort((a,b)=>a.localeCompare(b,'ru'))});
 }
 return days;
}
function monthlyStats(staff,periods,dayType,group,min){
 return months.map((name,index)=>{
  const days=calculateDaily(staff,periods,dayType,index,group).filter(d=>d.type==='workday');
  const absent=days.reduce((sum,d)=>sum+d.away,0),workdays=days.length;
  const critical=group==='*'&&min>0?days.filter(d=>d.working<min).length:0;
  const avg=days.length?Math.round(days.reduce((s,d)=>s+d.working,0)/days.length*10)/10:0;
  return {index,name,workdays,absent,peak:Math.max(0,...days.map(d=>d.away)),low:days.length?Math.min(...days.map(d=>d.working)):0,avg,critical};
 });
}
export function openPersonnelLoadReport({chart,members,vacations,dayType,onUpdateChart}){
 let dialog=document.getElementById('personnel-load-dialog');
 if(dialog)dialog.remove();
 dialog=document.createElement('dialog');
 dialog.id='personnel-load-dialog';
 dialog.className='personnel-load-dialog';
 dialog.innerHTML='<div class="load-header"><h2>Кадровая нагрузка · 2027</h2><button type="button" id="load-close" aria-label="Закрыть" title="Закрыть">×</button></div>'+
 '<p class="load-description">Прогноз по отпускам графика «'+escape(chart.name)+'». Болезни, командировки и прочие отсутствия не учитываются. Контроль проводится по рабочим дням производственного календаря.</p>'+
 '<div class="load-controls"><label>Месяц<select id="load-month">'+months.map((m,i)=>'<option value="'+i+'">'+m+'</option>').join('')+'</select></label>'+
 '<label>Группа<select id="load-group"><option value="*">Все группы</option>'+[...new Set(members.map(groupValue))].sort((a,b)=>a.localeCompare(b,'ru',{numeric:true})).map(g=>'<option value="'+escape(g)+'">'+escape(g||'Без группы')+'</option>').join('')+'</select></label>'+
 (chart.allStaff?'<p class="load-rule">Общий график: норматив минимальной численности не устанавливается.</p>':
 '<label>Минимум работающих в графике<input id="load-minimum" type="number" min="0" max="9999" step="1" value="'+(Number(chart.minWorking)||0)+'"><small>0 — без контроля; норматив относится ко всему графику</small></label>')+'</div>'+
 '<div id="load-summary" class="load-summary"></div>'+
 '<h3>По месяцам</h3><div class="load-scroll"><table class="load-table"><thead><tr><th>Месяц</th><th>Рабочих дней</th><th>Человеко-дней отпуска</th><th>Макс. в отпуске</th><th>Мин. остаются</th><th>Среднее остаются</th><th>Ниже минимума</th></tr></thead><tbody id="load-monthly"></tbody></table></div>'+
 '<h3 id="load-detail-title">По дням</h3><div class="load-scroll"><table class="load-table"><thead><tr><th>Дата</th><th>По графику</th><th>В отпуске</th><th>Остаются</th><th>Доступность</th><th>Фамилии отсутствующих</th></tr></thead><tbody id="load-daily"></tbody></table></div>'+
 '<p class="load-note">Выходные и праздничные дни показаны справочно и не участвуют в проверке минимальной численности. Показатель «остаются» — плановая доступность по отпускам, не фактическая явка.</p>';
 document.body.appendChild(dialog);
 const monthEl=dialog.querySelector('#load-month'),groupEl=dialog.querySelector('#load-group'),minEl=dialog.querySelector('#load-minimum');
 monthEl.value=String(new Date().getFullYear()===2027?new Date().getMonth():0);
 const render=()=>{
  const month=Number(monthEl.value),group=groupEl.value,min=chart.allStaff?0:Math.max(0,Number(chart.minWorking)||0);
  const all=monthlyStats(members,vacations,dayType,group,min);
  const monthly=all[month],days=calculateDaily(members,vacations,dayType,month,group);
  const isChecking=group==='*'&&!chart.allStaff&&min>0;
  const work=days.filter(d=>d.type==='workday');
  const people=group==='*'?members:members.filter(d=>groupValue(d)===group);
  dialog.querySelector('#load-summary').innerHTML='<div><strong>'+people.length+'</strong><span>Сотрудников в составе</span></div><div><strong>'+monthly.workdays+'</strong><span>Рабочих дней</span></div><div><strong>'+monthly.absent+'</strong><span>Человеко-дней отпуска</span></div><div><strong>'+monthly.peak+'</strong><span>Максимум в отпуске за день</span></div>'+(isChecking?'<div class="'+(monthly.critical?'load-bad':'')+'"><strong>'+monthly.critical+'</strong><span>Дней ниже минимума</span></div>':'');
  dialog.querySelector('#load-monthly').innerHTML=all.map(r=>'<tr class="'+(r.index===month?'load-selected':'')+'"><td><button type="button" data-load-month="'+r.index+'">'+r.name+'</button></td><td>'+r.workdays+'</td><td>'+r.absent+'</td><td>'+r.peak+'</td><td>'+r.low+'</td><td>'+r.avg.toFixed(1).replace('.',',')+'</td><td class="'+(isChecking&&r.critical?'load-bad-text':'')+'">'+(isChecking?r.critical:'—')+'</td></tr>').join('');
  dialog.querySelector('#load-detail-title').textContent='По дням · '+months[month]+(group==='*'?'':' · группа '+(group||'Без группы'));
  dialog.querySelector('#load-daily').innerHTML=days.map(d=>{
   const inactive=d.type!=='workday';
   const violation=isChecking&&!inactive&&d.working<min;
   return '<tr class="'+(inactive?'load-nonwork ':'')+(violation?'load-violation':'')+'"><td>'+d.date.slice(8,10)+'.'+d.date.slice(5,7)+'.27'+(inactive?' · выходной':'')+'</td><td>'+d.total+'</td><td>'+d.away+'</td><td>'+d.working+(violation?' <strong title="Ниже минимума">!</strong>':'')+'</td><td>'+(d.availablePct===null?'—':d.availablePct.toFixed(1).replace('.',',')+' %')+'</td><td>'+escape(d.names.join(', ')||'—')+'</td></tr>';
  }).join('');
  dialog.querySelectorAll('[data-load-month]').forEach(b=>b.onclick=()=>{monthEl.value=b.dataset.loadMonth;render()});
 };
 monthEl.onchange=render;groupEl.onchange=render;
 if(minEl)minEl.onchange=()=>{
  const raw=Number(minEl.value);
  if(!Number.isInteger(raw)||raw<0||raw>9999){minEl.value=String(chart.minWorking||0);return}
  chart.minWorking=raw;
  onUpdateChart();
  render();
 };
 dialog.querySelector('#load-close').onclick=()=>dialog.close();
 dialog.onclose=()=>dialog.remove();
 render();dialog.showModal();
}
