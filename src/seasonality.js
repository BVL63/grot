// КСН — месячная сезонная нагрузка; КОН — индивидуальная нагрузка без самого водителя.
// Источник: отдельный исторический график. Данные 2027 не подменяют историю 2026.
const STORAGE='grot-seasonality-history-v1';
export function loadHistory(){try{return JSON.parse(localStorage.getItem(STORAGE)||'[]')}catch{return []}}
export function saveHistory(rows){localStorage.setItem(STORAGE,JSON.stringify(rows))}
export function calculateSeasonality(rows,year=2026){
 const data=rows.filter(r=>Number(r.year)===year&&r.driver&&/^\d{4}-\d{2}-\d{2}$/.test(r.start)&&/^\d{4}-\d{2}-\d{2}$/.test(r.end)&&r.start<=r.end);
 const counts=Array(12).fill(0),byDriver=new Map(),unique=new Set();
 for(const r of data){let date=new Date(r.start+'T12:00:00Z'),end=new Date(r.end+'T12:00:00Z');let n=0;
  while(date<=end&&n++<366){if(date.getUTCFullYear()===year){const iso=date.toISOString().slice(0,10),key=r.driver+'|'+iso;if(!unique.has(key)){unique.add(key);const m=date.getUTCMonth();counts[m]++;if(!byDriver.has(r.driver))byDriver.set(r.driver,Array(12).fill(0));byDriver.get(r.driver)[m]++;}}date.setUTCDate(date.getUTCDate()+1)}
 }
 const total=counts.reduce((a,b)=>a+b,0),avg=total/12;
 const months=counts.map((days,i)=>({month:i+1,days,ksn:avg?days/avg:null}));
 const drivers=[...byDriver].map(([name,days])=>{const own=days.reduce((a,b)=>a+b,0),others=total-own;
  const ksn=avg?days.reduce((s,d,m)=>s+d*counts[m]/avg,0)/own:null;
  const kon=others?days.reduce((s,d,m)=>s+d*(counts[m]-days[m])/(others/12),0)/own:null;
  return {name,days:own,ksn,kon};
 }).sort((a,b)=>(a.kon??Infinity)-(b.kon??Infinity));
 return {months,drivers,total};
}
export function seasonalityDialog(){
 const dialog=document.createElement('dialog');dialog.id='seasonality-dialog';dialog.style.cssText='max-width:min(960px,96vw);max-height:88vh;overflow:auto;padding:20px;border:1px solid #ccd3e0;border-radius:12px';
 dialog.innerHTML='<h2>КСН и КОН — история отпусков</h2><p>Загрузите данные за 2026 год в формате CSV: водитель;начало;конец. Даты: ГГГГ-ММ-ДД или ДД.ММ.ГГГГ. Один период — одна строка. Повторный импорт заменяет исторические данные выбранного года.</p><label>Год <input id="season-year" type="number" min="2020" max="2100" value="2026" style="width:90px"></label> <input id="season-file" type="file" accept=".csv,text/csv"> <button id="season-close">Закрыть</button><p id="season-status"></p><div id="season-results"></div>';
 document.body.append(dialog);
 const el=id=>dialog.querySelector('#'+id);
 const fmt=n=>n===null?'—':n.toFixed(3).replace('.',',');
 function draw(){const year=Number(el('season-year').value),res=calculateSeasonality(loadHistory(),year);
 el('season-results').innerHTML=!res.total?'<p>Нет исторических данных за выбранный год. Загрузите CSV.</p>':'<h3>КСН по месяцам</h3><div style="overflow:auto"><table><thead><tr><th>Месяц</th><th>Дней</th><th>КСН</th></tr></thead><tbody>'+res.months.map((r,i)=>'<tr><td>'+['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'][i]+'</td><td>'+r.days+'</td><td>'+fmt(r.ksn)+'</td></tr>').join('')+'</tbody></table></div><h3>Показатели водителей</h3><p>КСН — средняя сезонная нагрузка дат отпуска. КОН — сезонность остальных водителей в те же месяцы, без собственного отпуска. Меньший КОН даёт приоритет при конфликте внутри группы.</p><div style="overflow:auto"><table><thead><tr><th>Водитель</th><th>Дней</th><th>КСН</th><th>КОН без себя</th></tr></thead><tbody>'+res.drivers.map(r=>'<tr><td>'+r.name.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))+'</td><td>'+r.days+'</td><td>'+fmt(r.ksn)+'</td><td>'+fmt(r.kon)+'</td></tr>').join('')+'</tbody></table></div>';
 }
 el('season-year').onchange=draw;el('season-close').onclick=()=>dialog.close();
 el('season-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;const text=await file.text();const year=Number(el('season-year').value);
 const parseDate=v=>{v=v.trim();const m=v.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);return m?m[3]+'-'+m[2]+'-'+m[1]:v};
 const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(x=>x.trim());const sep=(lines[0]||'').includes(';')?';':',';
 const rows=lines.map(l=>l.split(sep).map(s=>s.trim().replace(/^"|"$/g,''))).filter(p=>p.length>=3).map(p=>({year,driver:p[0],start:parseDate(p[1]),end:parseDate(p[2])})).filter(r=>r.driver&&r.start.startsWith(year+'-')&&/^\d{4}-\d{2}-\d{2}$/.test(r.end)&&r.end>=r.start);
 if(!rows.length){el('season-status').textContent='Не найдены корректные периоды. Проверьте CSV и год.';return}
 saveHistory(loadHistory().filter(r=>Number(r.year)!==year).concat(rows));el('season-status').textContent='Загружено периодов: '+rows.length+'. Данные сохранены в этом браузере.';draw();};
 draw();dialog.showModal();
}
