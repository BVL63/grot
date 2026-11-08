import { historical2026 } from './history2026.js';
// КСН — месячная сезонная нагрузка; КОН — индивидуальная нагрузка без самого водителя.
// Источник: отдельный исторический график. Данные 2027 не подменяют историю 2026.
const STORAGE='grot-seasonality-history-v1';
export function loadHistory(){let saved=[];try{saved=JSON.parse(localStorage.getItem(STORAGE)||'[]');if(!Array.isArray(saved))saved=[]}catch{}return saved.some(r=>Number(r.year)===2026)?saved:historical2026.concat(saved)}
export function saveHistory(rows){localStorage.setItem(STORAGE,JSON.stringify(rows))}
export function calculateSeasonality(rows,year=2026,activeStaff=null){
 const roster=activeStaff===null?null:new Set(activeStaff);
 const data=rows.filter(r=>Number(r.year)===year&&r.driver&&(!roster||roster.has(r.driver))&&/^\d{4}-\d{2}-\d{2}$/.test(r.start)&&/^\d{4}-\d{2}-\d{2}$/.test(r.end)&&r.start<=r.end);
 const byDriver=new Map(),daily=new Map(),counts=Array(12).fill(0);
 for(const r of data){if(!byDriver.has(r.driver))byDriver.set(r.driver,new Set());
  for(let date=new Date(r.start+'T12:00:00Z'),end=new Date(r.end+'T12:00:00Z'),n=0;date<=end&&n++<366;date.setUTCDate(date.getUTCDate()+1)){
   if(date.getUTCFullYear()===year)byDriver.get(r.driver).add(date.toISOString().slice(0,10));
  }
 }
 for(const [name,days] of byDriver)for(const day of days){
  if(!daily.has(day))daily.set(day,new Set());daily.get(day).add(name);counts[Number(day.slice(5,7))-1]++;
 }
 const total=counts.reduce((a,b)=>a+b,0),avg=total/12,maxMonth=Math.max(...counts),population=roster?roster.size:byDriver.size;
 const months=counts.map((days,i)=>({month:i+1,days,ksn:avg?days/avg:null}));
 const drivers=[...byDriver].map(([name,days])=>{
  const own=days.size;
  const kon=population>1&&own?[...days].reduce((sum,day)=>sum+(daily.get(day).size-1)/(population-1),0)/own*100:0;
  const ksn=own&&avg?[...days].reduce((sum,day)=>sum+counts[Number(day.slice(5,7))-1]/avg,0)/own:null;
  const ksnNormalized=own&&maxMonth?[...days].reduce((sum,day)=>sum+counts[Number(day.slice(5,7))-1]/maxMonth,0)/own*100:0;
  return {name,days:own,ksn,kon,ksnNormalized,ipo:0.6*kon+0.4*ksnNormalized};
 }).sort((a,b)=>a.ipo-b.ipo||a.name.localeCompare(b.name,'ru'));
 return {months,drivers,total,population};
}
export function seasonalityDialog(currentRows=[],defaultYear=2026,staffForYear=()=>null,chartName='Общий график'){
 const dialog=document.createElement('dialog');dialog.id='seasonality-dialog';dialog.style.cssText='max-width:min(960px,96vw);max-height:88vh;overflow:auto;padding:20px;border:1px solid #ccd3e0;border-radius:12px';
 dialog.innerHTML='<h2>КОН, КСН и ИПО — '+chartName.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))+'</h2><p>Для 2027 года используются текущие отпуска из графика. Для архивных годов можно загрузить CSV: водитель;начало;конец. Даты: ГГГГ-ММ-ДД или ДД.ММ.ГГГГ. Один период — одна строка. Повторный импорт заменяет исторические данные выбранного года.</p><label>Год <input id="season-year" type="number" min="2020" max="2100" value="2026" style="width:90px"></label> <input id="season-file" type="file" accept=".csv,text/csv"> <button id="season-close">Закрыть</button><p id="season-status"></p><div id="season-results"></div>';
 document.body.append(dialog);
 const el=id=>dialog.querySelector('#'+id);
 el('season-year').value=String(defaultYear);
 const fmt=n=>n===null?'—':n.toFixed(2).replace('.',',');
 function draw(){const year=Number(el('season-year').value),res=calculateSeasonality(loadHistory().filter(r=>Number(r.year)!==2027).concat(currentRows),year,staffForYear(year));
 el('season-results').innerHTML=!res.total?'<p>Нет исторических данных за выбранный год. Загрузите CSV.</p>':'<h3>КСН по месяцам</h3><div style="overflow:auto"><table><thead><tr><th>Месяц</th><th>Дней</th><th>КСН</th></tr></thead><tbody>'+res.months.map((r,i)=>'<tr><td>'+['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'][i]+'</td><td>'+r.days+'</td><td>'+fmt(r.ksn)+'</td></tr>').join('')+'</tbody></table></div><h3>Очередность выбора на следующий год</h3><p>ИПО = 60% КОН + 40% КСНн. КОН — средняя доля коллег в отпуске по дням, без самого водителя. База расчёта — сотрудники выбранного графика, включая сотрудников без внесённых отпусков в 2027 году. Сотрудники без отпусков не участвуют в очередности. КСНн — средняя месячная нагрузка относительно самого загруженного месяца, %. Меньший ИПО даёт приоритет при конфликте пожеланий между сотрудниками. Законные преимущества сохраняются. Показатели рассчитаны только по участникам выбранного графика, без разделения на группы.</p><div style="overflow:auto"><table><thead><tr><th>Приоритет</th><th>Сотрудник</th><th>Дней</th><th>КОН, %</th><th>КСН</th><th>КСНн, %</th><th>ИПО</th></tr></thead><tbody>'+res.drivers.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+r.name.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))+'</td><td>'+r.days+'</td><td>'+fmt(r.kon)+'</td><td>'+fmt(r.ksn)+'</td><td>'+fmt(r.ksnNormalized)+'</td><td><strong>'+fmt(r.ipo)+'</strong></td></tr>').join('')+'</tbody></table></div>';
 }
 el('season-year').onchange=draw;el('season-close').onclick=()=>dialog.close();
 el('season-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;const text=await file.text();const year=Number(el('season-year').value);
 const parseDate=v=>{v=v.trim();const m=v.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);return m?m[3]+'-'+m[2]+'-'+m[1]:v};
 const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(x=>x.trim());const sep=(lines[0]||'').includes(';')?';':',';
 const rows=lines.map(l=>l.split(sep).map(s=>s.trim().replace(/^"|"$/g,''))).filter(p=>p.length>=3).map(p=>({year,driver:p[0],start:parseDate(p[1]),end:parseDate(p[2])})).filter(r=>r.driver&&r.start.startsWith(year+'-')&&/^\d{4}-\d{2}-\d{2}$/.test(r.end)&&r.end>=r.start);
 if(year===2027){el('season-status').textContent='Для 2027 года данные берутся из рабочего графика. CSV не импортирован.';return}
 if(!rows.length){el('season-status').textContent='Не найдены корректные периоды. Проверьте CSV и год.';return}
 saveHistory(loadHistory().filter(r=>Number(r.year)!==year).concat(rows));el('season-status').textContent='Загружено периодов: '+rows.length+'. Данные сохранены в этом браузере.';draw();};
 draw();dialog.showModal();
}
