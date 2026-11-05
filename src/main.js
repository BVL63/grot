import './style.css';

const app = document.querySelector('#app');
const months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const defaultDrivers = [
  { id: 1, name: 'Иванов И.И.', group: '9' },
  { id: 2, name: 'Петров П.П.', group: '9' },
  { id: 3, name: 'Сидоров С.С.', group: '9.1' }
];
const staffKey='vacationStaff2027';
let drivers;
try { const stored=JSON.parse(localStorage.getItem(staffKey)||'null'); drivers=Array.isArray(stored)&&stored.length?stored:defaultDrivers.map(d=>({...d,allowance:36,department:''})); } catch { drivers=defaultDrivers.map(d=>({...d,allowance:36,department:''})); }
drivers=drivers.map(d=>({...d,allowance:Number.isFinite(Number(d.allowance))?Number(d.allowance):36}));
function saveStaff(){localStorage.setItem(staffKey,JSON.stringify(drivers));}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
const key = 'vacations2027';
let selectedMonth = 0;
const expandedMonths = new Set();
let selectedDriverIds=null,selectedGroups=null;
let vacations;
try {
  const saved = JSON.parse(localStorage.getItem(key) || '[]');
  vacations = Array.isArray(saved) ? saved : [];
} catch {
  vacations = [];
}
let editingPeriod = null;
let notice = '';

function iso(date) {
  return [date.getUTCFullYear(), String(date.getUTCMonth()+1).padStart(2,'0'), String(date.getUTCDate()).padStart(2,'0')].join('-');
}
function shift(date, amount) {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + amount);
  return iso(d);
}
function daysFor(id) {
  const days = new Set();
  for (const v of vacations) {
    if (Number(v.driverId) !== id || !/^2027-\d\d-\d\d$/.test(v.start || '') || !/^2027-\d\d-\d\d$/.test(v.end || '') || v.end < v.start) continue;
    for (let d = v.start, n = 0; d <= v.end && n < 366; d = shift(d, 1), n++) days.add(d);
  }
  return days;
}
function replaceDays(id, days) {
  const dates = [...days].sort();
  const periods = [];
  let start = null, end = null;
  for (const date of dates) {
    if (start === null) start = end = date;
    else if (shift(end, 1) === date) end = date;
    else {
      periods.push({driverId:id,start,end});
      start = end = date;
    }
  }
  if (start !== null) periods.push({driverId:id,start,end});
  vacations = vacations.filter(v => Number(v.driverId) !== id).concat(periods);
  localStorage.setItem(key, JSON.stringify(vacations));
}
function periodsFor(id) {
  return vacations.filter(v => Number(v.driverId) === id && v.start && v.end).sort((a,b)=>a.start.localeCompare(b.start));
}
function store() { localStorage.setItem(key, JSON.stringify(vacations)); }
function displayDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return value;
  const [y,m,d]=value.split('-');
  return d+'.'+m+'.'+y.slice(2);
}
function splitRule(id) {
  const periods=periodsFor(id);
  if (!periods.length) return '';
  const hasLongPart=periods.some(p => leaveDays(p.start,p.end) >= 14);
  return hasLongPart
    ? ''
    : '<p class="rule-warning">⚠ Пока нет части отпуска продолжительностью не менее 14 календарных дней. Перед утверждением графика необходимо предусмотреть такую часть.</p>';
}
const defaultHolidays2027 = new Set(['2027-01-01','2027-01-02','2027-01-03','2027-01-04','2027-01-05','2027-01-06','2027-01-07','2027-01-08','2027-02-23','2027-03-08','2027-05-01','2027-05-09','2027-06-12','2027-11-04']);
const calendarKey='productionCalendar2027';
let calendarOverrides={};
try { calendarOverrides=JSON.parse(localStorage.getItem(calendarKey)||'{}')||{}; } catch {}
function dayType(date) {
  if (Object.prototype.hasOwnProperty.call(calendarOverrides,date)) return calendarOverrides[date];
  if(defaultHolidays2027.has(date)) return 'holiday';
  return [0,6].includes(new Date(date+'T12:00:00Z').getUTCDay())?'weekend':'workday';
}
function leaveDays(start,end) {
  if (!start || !end || end<start) return 0;
  let total=0;
  for(let d=start,n=0;d<=end && n<366;d=shift(d,1),n++) if(dayType(d)!=='holiday') total++;
  return total;
}
function calendarDays(p) {
  return Math.round((Date.parse(p.end+'T12:00:00Z')-Date.parse(p.start+'T12:00:00Z'))/86400000)+1;
}
function periodList(id) {
  const items=periodsFor(id);
  return items.length ? items.map((v,i)=>`<div class="period-row"><span class="period-dates">${displayDate(v.start)} — ${displayDate(v.end)}</span><strong class="period-days">${leaveDays(v.start,v.end)} дн.</strong><button type="button" data-edit="${i}">Изменить</button><button type="button" data-remove="${i}">Удалить</button></div>`).join('') : '<p>Периодов пока нет.</p>';
}
function dateAt(day) {
  return '2027-' + String(selectedMonth+1).padStart(2,'0') + '-' + String(day).padStart(2,'0');
}
function render() {
  const sets = new Map(drivers.map(d => [d.id, daysFor(d.id)]));
  const dateOf=(m,d)=>'2027-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
  const monthDays=m=>new Date(2027,m+1,0).getDate();
  const monthlyCount=(set,m)=>{let n=0;for(let d=1;d<=monthDays(m);d++){const date=dateOf(m,d);if(set.has(date)&&dayType(date)!=='holiday')n++;}return n;};
  const columns=months.flatMap((_,m)=>expandedMonths.has(m)?Array.from({length:monthDays(m)},(_,i)=>({m,day:i+1})): [{m,day:0}]);
  const headings=columns.map(c=>'<th class="'+(c.day?'day-heading':'month-heading')+'"><button type="button" data-month="'+c.m+'" title="'+(expandedMonths.has(c.m)?'Свернуть ':'Развернуть ')+months[c.m]+'">'+(c.day||months[c.m].slice(0,3))+'</button></th>').join('');
  const visibleDrivers=drivers.filter(d=>(selectedDriverIds===null||selectedDriverIds.has(String(d.id)))&&(selectedGroups===null||selectedGroups.has(String(d.group))));
  const groups=[...new Set(drivers.map(d=>String(d.group)))].sort((a,b)=>a.localeCompare(b,'ru',{numeric:true}));
  const annualCount=id=>periodsFor(id).reduce((sum,p)=>sum+leaveDays(p.start,p.end),0);
  const rows=visibleDrivers.map(d=>'<tr><th class="fixed name"><button class="driver" data-driver="'+d.id+'">'+escapeHtml(d.name)+'</button></th><td class="fixed group">'+escapeHtml(d.group)+'</td>'+columns.map(c=>{const set=sets.get(d.id);if(!c.day){const n=monthlyCount(set,c.m);return '<td class="month-cell '+(n?'has-vacation':'')+'" data-month="'+c.m+'">'+(n||'—')+'</td>';}const date=dateOf(c.m,c.day),active=set.has(date),type=dayType(date);return '<td class="day '+(active?'vacation ':'')+(type==='weekend'?'weekend ':'')+(type==='holiday'?'holiday':'')+'" data-id="'+d.id+'" data-date="'+date+'">'+(active?'●':'')+'</td>';}).join('')+'<td class="annual-total">'+annualCount(d.id)+'</td></tr>').join('');
  const totals=columns.map(c=>'<td>'+(c.day?visibleDrivers.filter(d=>sets.get(d.id).has(dateOf(c.m,c.day))).length:visibleDrivers.filter(d=>monthlyCount(sets.get(d.id),c.m)>0).length)+'</td>').join('');
  app.innerHTML = `
    <header><h1>График отпусков — 2027</h1><p>Планирование отпусков водителей</p></header>
    <main>
      <div class="toolbar"><button id="collapse-month" type="button">Свернуть все месяцы</button>
      <button id="staff-open" type="button">Сотрудники</button><button type="button" id="backup-export">Резервная копия</button><button type="button" id="backup-restore">Восстановить</button><input type="file" id="backup-file" accept=".json,application/json" hidden><button id="period">Добавить период отпуска</button><button id="help-open" type="button">Справка · Правила отпусков</button><button id="calendar-open" type="button">Производственный календарь</button></div>
      <div class="scroll"><table class="annual-table"><thead><tr>
      <th class="fixed name"><span class="header-filter">Водитель <button type="button" class="filter-trigger" data-filter-open="driver" aria-label="Фильтр водителей">▾</button></span></th>
      <th class="fixed group"><span class="header-filter">Группа <button type="button" class="filter-trigger" data-filter-open="group" aria-label="Фильтр групп">▾</button></span></th>${headings}<th class="annual-total-heading">Всего дней</th></tr></thead>
      <tbody>${rows}</tbody><tfoot><tr><th class="fixed name">В отпуске</th><td class="fixed group"></td>${totals}<td class="annual-total">${visibleDrivers.filter(d=>annualCount(d.id)>0).length}</td></tr></tfoot></table></div>
      <p>Нажмите на название месяца, чтобы развернуть его дни; повторное нажатие свернёт только этот месяц. Можно открыть несколько месяцев одновременно. Нажмите на фамилию для просмотра отпусков.</p>
      <p class="notice" role="status">${notice}</p>
      <p class="muted">Тестовая версия: данные хранятся только в этом браузере, не в облаке.</p>
    </main>
    <dialog id="filter-dialog"><h2 id="filter-title">Фильтр</h2><div class="filter-actions"><button type="button" id="filter-all">Выбрать все</button><button type="button" id="filter-none">Снять все</button></div><div id="filter-options"></div><div class="actions"><button type="button" id="filter-cancel">Отмена</button><button type="button" id="filter-apply">Применить</button></div></dialog>
    <dialog id="staff-dialog"><h2>Справочник сотрудников</h2>
      <div id="staff-list"></div>
      <form id="staff-form">
        <input type="hidden" id="staff-id">
        <label>ФИО <input id="staff-name" required maxlength="100"></label>
        <label>Подразделение <input id="staff-department" maxlength="100"></label>
        <label>Группа отпусков <input id="staff-group" required maxlength="30"></label>
        <label>Дней ежегодного отпуска <input id="staff-allowance" type="number" min="1" max="120" required value="36"></label>
        <p id="staff-error" role="alert"></p>
        <div class="actions"><button type="button" id="staff-reset">Новый сотрудник</button><button type="submit">Сохранить</button><button type="button" id="staff-close">Закрыть</button></div>
      </form>
    </dialog>
    <dialog id="editor"><form id="vacation-form">
      <div class="editor-header"><h2 id="editor-title">Отпуска 2027</h2></div>
      <label class="editor-person-label">Водитель <select id="person">${drivers.map(d=>`<option value="${d.id}">${d.name} — группа ${d.group}</option>`).join('')}</select></label>
      <div class="editor-top"><div class="editor-mode-actions"><button type="button" id="mode-add">Добавить период</button><button type="button" id="mode-edit">Изменить</button><button type="button" id="mode-delete">Удалить</button></div><p class="muted">Календарь 2027 года · выбор начала и окончания отпуска</p>
      <p id="range-hint">Выберите начало отпуска, затем окончание.</p></div>
      <div class="editor-calendar-scroll"><div id="range-calendar" class="range-calendar"></div></div>
      <div class="editor-bottom"><div id="range-selected"></div><div id="range-periods" class="period-scroll" tabindex="0"></div>
      <input id="start" type="hidden"><input id="end" type="hidden">
      <div id="day-count" class="day-count" aria-live="polite"></div><p id="editor-split-warning" class="rule-warning" role="status"></p><p class="muted">Добавление создаёт новый период. Изменение заменяет выбранный период.</p>
      <p id="form-error" role="alert"></p>
      <div class="actions"><button type="button" id="cancel">Закрыть</button><button type="submit">Сохранить</button></div></div>
    </form></dialog>
    <dialog id="calendar-dialog"><h2>Производственный календарь — 2027</h2>
      <p>CSV с колонками date;type. Дата в формате ГГГГ-ММ-ДД; тип holiday (праздник), weekend (выходной), workday (рабочий).</p>
      <p>Пример: 2027-01-01;holiday</p>
      <p>Неуказанные даты берутся из базового календаря. Импорт заменяет предыдущие пользовательские настройки календаря, но не отпуска.</p>
      <input type="file" id="calendar-file" accept=".csv,text/csv,text/plain">
      <p id="calendar-status" role="status"></p>
      <div class="actions"><button type="button" id="calendar-close">Закрыть</button><button type="button" id="calendar-import" disabled>Подтвердить импорт</button></div>
    </dialog>
    <dialog id="help-dialog"><h2>Справка · Правила отпусков</h2>
      <p><strong>Разделение отпуска — статья 125 ТК РФ.</strong> По соглашению работника и работодателя ежегодный оплачиваемый отпуск может быть разделён на части. Хотя бы одна из частей должна быть не менее <strong>14 календарных дней</strong>. Это не обязательно первая часть по времени.</p>
      <p>Например, при отпуске 36 дней допустимо 7 + 14 + 15 дней; 12 + 12 + 12 дней — недопустимо.</p>
      <p>Проверка пока носит предупредительный характер: график может быть заполнен не полностью. Перед утверждением необходимо выполнить правило.</p>
      <p><strong>Праздники — статья 120 ТК РФ.</strong> Нерабочие праздничные дни, приходящиеся на ежегодный оплачиваемый отпуск, в число календарных дней отпуска не включаются. В расчёте учитываются праздничные даты по статье 112 ТК РФ. Перенесённые выходные не исключаются из отпуска.</p>
      <p><strong>Продолжительность отпуска</strong> определяется для каждого сотрудника индивидуально. Планируемая норма водителей — 36 календарных дней, с возможностью изменения в справочнике сотрудников.</p>
      <p><a href="https://www.consultant.ru/document/cons_doc_LAW_34683/1f8b77b8e94f97ce88b74f92e54177e36b1d93b7/" target="_blank" rel="noopener">Трудовой кодекс РФ</a> · <a href="https://онлайнинспекция.рф/" target="_blank" rel="noopener">Онлайнинспекция.рф</a></p>
      <div class="actions"><button type="button" id="help-close">Закрыть</button></div></dialog>
    <dialog id="driver-card"><h2 id="driver-title">Отпуска водителя</h2><div id="period-list"></div><div id="period-total" class="day-count"></div><div id="split-rule"></div><div class="actions"><button type="button" id="driver-close">Закрыть</button><button type="button" id="driver-add">Добавить период</button></div></dialog>`;
  document.querySelector('#backup-export').onclick=()=>{
    const payload={format:'grot-backup',version:1,year:2027,createdAt:new Date().toISOString(),staff:drivers,vacations,calendarOverrides};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;const now=new Date();const stamp=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-')+'-'+[now.getHours(),now.getMinutes(),now.getSeconds()].map(x=>String(x).padStart(2,'0')).join('-');
    a.download='grot-'+stamp+'.json';
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    notice='Резервная копия подготовлена. Сохраните файл в надёжном месте.';
    document.querySelector('.notice').textContent=notice;
  };
  document.querySelector('#backup-restore').onclick=()=>document.querySelector('#backup-file').click();
  document.querySelector('#backup-file').onchange=async e=>{
    const file=e.target.files?.[0];e.target.value='';
    if(!file)return;
    try{
      if(file.size>5_000_000)throw Error('Файл слишком большой (более 5 МБ).');
      const data=JSON.parse(await file.text());
      if(!data||data.format!=='grot-backup'||data.version!==1||data.year!==2027)throw Error('Это не резервная копия ГРОТ за 2027 год.');
      if(!Array.isArray(data.staff)||!data.staff.length||!Array.isArray(data.vacations)||!data.calendarOverrides||typeof data.calendarOverrides!=='object'||Array.isArray(data.calendarOverrides))throw Error('В файле отсутствуют обязательные данные.');
      const ids=new Set();
      for(const d of data.staff){
        if(!d||!Number.isSafeInteger(d.id)||d.id<1||typeof d.name!=='string'||!d.name.trim()||typeof d.group!=='string'||!d.group.trim()||!Number.isInteger(Number(d.allowance))||Number(d.allowance)<1||Number(d.allowance)>120||ids.has(d.id))throw Error('Ошибка в справочнике сотрудников.');
        ids.add(d.id);
      }
      const validDate=x=>typeof x==='string'&&/^2027-\\d{2}-\\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+'T12:00:00Z'))&&new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;
      for(const p of data.vacations){
        if(!p||!ids.has(Number(p.driverId))||!validDate(p.start)||!validDate(p.end)||p.end<p.start)throw Error('Ошибка в периодах отпусков.');
      }
      for(const [date,type] of Object.entries(data.calendarOverrides)){
        if(!validDate(date)||!['holiday','weekend','workday'].includes(type))throw Error('Ошибка в производственном календаре.');
      }
      if(!confirm('Восстановить копию от '+(data.createdAt?new Date(data.createdAt).toLocaleString('ru-RU'):'неизвестной даты')+'?\\nСотрудников: '+data.staff.length+'\\nПериодов отпусков: '+data.vacations.length+'\\n\\nТЕКУЩИЕ данные браузера будут заменены. Продолжить?'))return;
      const previous=[localStorage.getItem(staffKey),localStorage.getItem(key),localStorage.getItem(calendarKey)];
      try{
        localStorage.setItem(staffKey,JSON.stringify(data.staff));
        localStorage.setItem(key,JSON.stringify(data.vacations));
        localStorage.setItem(calendarKey,JSON.stringify(data.calendarOverrides));
      }catch(err){
        [staffKey,key,calendarKey].forEach((k,i)=>{try{if(previous[i]===null)localStorage.removeItem(k);else localStorage.setItem(k,previous[i]);}catch{}});
        throw Error('Не удалось сохранить данные. Предыдущие записи восстановлены, насколько позволило хранилище.');
      }
      drivers=data.staff;vacations=data.vacations;calendarOverrides=data.calendarOverrides;
      selectedDriverIds=null;selectedGroups=null;
      notice='Резервная копия восстановлена: '+drivers.length+' сотрудников, '+vacations.length+' периодов.';
      render();
    }catch(err){alert('Восстановление отменено: '+err.message);}
  };
  function drawStaff(){
    document.querySelector('#staff-list').innerHTML=drivers.map(d=>'<div class="period-row"><span>'+escapeHtml(d.name)+' · '+escapeHtml(d.group)+' · '+d.allowance+' дн.</span><button type="button" data-staff="'+d.id+'">Изменить</button><button type="button" data-staff-delete="'+d.id+'">Удалить</button></div>').join('');
    document.querySelectorAll('[data-staff]').forEach(b=>b.onclick=()=>{
      const d=drivers.find(x=>x.id===Number(b.dataset.staff));
      document.querySelector('#staff-id').value=d.id;
      document.querySelector('#staff-name').value=d.name;
      document.querySelector('#staff-department').value=d.department||'';
      document.querySelector('#staff-group').value=d.group;
      document.querySelector('#staff-allowance').value=d.allowance;
    });
  }
  document.querySelector('#staff-list').addEventListener('click',e=>{
    const button=e.target.closest('[data-staff-delete]');
    if(!button)return;
    const id=Number(button.dataset.staffDelete);
    const d=drivers.find(x=>x.id===id);
    if(!d)return;
    if(drivers.length<=1){alert('Нельзя удалить последнего сотрудника. Сначала добавьте другого.');return;}
    const count=periodsFor(id).length;
    if(!confirm('Удалить сотрудника «'+d.name+'» и его периоды отпуска ('+count+')? Это действие нельзя отменить.'))return;
    drivers=drivers.filter(x=>x.id!==id);
    vacations=vacations.filter(v=>Number(v.driverId)!==id);
    saveStaff();store();
    if(selectedDriverIds!==null)selectedDriverIds.delete(String(id));
    document.querySelector('#staff-id').value='';
    document.querySelector('#staff-form').reset();
    notice='Сотрудник и его отпуска удалены.';
    document.querySelector('#staff-dialog').close();render();
  });
  document.querySelector('#staff-open').onclick=()=>{drawStaff();document.querySelector('#staff-dialog').showModal();};
  document.querySelector('#staff-close').onclick=()=>document.querySelector('#staff-dialog').close();
  document.querySelector('#staff-reset').onclick=()=>{document.querySelector('#staff-form').reset();document.querySelector('#staff-id').value='';};
  document.querySelector('#staff-form').onsubmit=e=>{
    e.preventDefault();
    const id=Number(document.querySelector('#staff-id').value);
    const name=document.querySelector('#staff-name').value.trim(),department=document.querySelector('#staff-department').value.trim(),group=document.querySelector('#staff-group').value.trim(),allowance=Number(document.querySelector('#staff-allowance').value);
    if(!name||!group||!Number.isInteger(allowance)||allowance<1||allowance>120)return;
    if(id){const d=drivers.find(x=>x.id===id);Object.assign(d,{name,department,group,allowance});}
    else drivers.push({id:Math.max(0,...drivers.map(d=>d.id))+1,name,department,group,allowance});
    saveStaff();document.querySelector('#staff-dialog').close();render();
  };
  let pendingCalendar=null;
  document.querySelector('#calendar-open').onclick=()=>document.querySelector('#calendar-dialog').showModal();
  document.querySelector('#calendar-close').onclick=()=>document.querySelector('#calendar-dialog').close();
  document.querySelector('#calendar-file').onchange=async e=>{
    pendingCalendar=null;
    document.querySelector('#calendar-import').disabled=true;
    const file=e.target.files[0]; if(!file) return;
    try {
      const lines=(await file.text()).replace(/^\uFEFF/,'').trim().split(/\r?\n/);
      const separator=lines[0].includes(';')?';':',';
      const header=lines.shift().split(separator).map(v=>v.trim().toLowerCase());
      const di=header.indexOf('date'),ti=header.indexOf('type');
      if(di<0||ti<0) throw Error('Нужны колонки date и type.');
      const next={}; let n=0;
      for(const line of lines) {
        if(!line.trim()) continue;
        const cols=line.split(separator).map(v=>v.trim());
        const date=cols[di],type=cols[ti]?.toLowerCase();
        if(!/^2027-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date||!['holiday','weekend','workday'].includes(type)) throw Error('Некорректная строка: '+line);
        if(next[date]) throw Error('Повтор даты: '+date);
        next[date]=type;n++;
      }
      if(!n) throw Error('В файле нет дат.');
      pendingCalendar=next;
      document.querySelector('#calendar-status').textContent='Проверено дат: '+n+'. Для применения нажмите «Подтвердить импорт».';
      document.querySelector('#calendar-import').disabled=false;
    } catch(err) { document.querySelector('#calendar-status').textContent=err.message; }
  };
  document.querySelector('#calendar-import').onclick=()=>{
    if(!pendingCalendar) return;
    calendarOverrides=pendingCalendar;
    localStorage.setItem(calendarKey,JSON.stringify(calendarOverrides));
    notice='Производственный календарь загружен; расчёт отпусков обновлён.';
    document.querySelector('#calendar-dialog').close();render();
  };
  document.querySelector('#help-open').onclick=()=>document.querySelector('#help-dialog').showModal();
  document.querySelector('#help-close').onclick=()=>document.querySelector('#help-dialog').close();
  let activeFilter=null;
  const filterDialog=document.querySelector('#filter-dialog');
  const getFilterValues=()=>activeFilter==='driver'?drivers.map(d=>({id:String(d.id),label:d.name})):groups.map(g=>({id:g,label:g}));
  document.querySelectorAll('[data-filter-open]').forEach(b=>b.onclick=()=>{
    activeFilter=b.dataset.filterOpen;
    document.querySelector('#filter-title').textContent=activeFilter==='driver'?'Фильтр водителей':'Фильтр групп';
    const selected=activeFilter==='driver'?selectedDriverIds:selectedGroups;
    document.querySelector('#filter-options').innerHTML=getFilterValues().map(v=>'<label class="filter-option"><input type="checkbox" value="'+escapeHtml(v.id)+'" '+(selected===null||selected.has(v.id)?'checked':'')+'> '+escapeHtml(v.label)+'</label>').join('');
    filterDialog.showModal();
  });
  document.querySelector('#filter-all').onclick=()=>document.querySelectorAll('#filter-options input').forEach(x=>x.checked=true);
  document.querySelector('#filter-none').onclick=()=>document.querySelectorAll('#filter-options input').forEach(x=>x.checked=false);
  document.querySelector('#filter-cancel').onclick=()=>filterDialog.close();
  document.querySelector('#filter-apply').onclick=()=>{
    const checked=new Set([...document.querySelectorAll('#filter-options input:checked')].map(x=>x.value));
    const next=checked.size===getFilterValues().length?null:checked;
    if(activeFilter==='driver')selectedDriverIds=next;else selectedGroups=next;
    filterDialog.close();render();
  };
  document.querySelector('#collapse-month').onclick=()=>{expandedMonths.clear();render();};
  document.querySelectorAll('[data-month]').forEach(el=>el.onclick=()=>{const m=Number(el.dataset.month);if(expandedMonths.has(m))expandedMonths.delete(m);else expandedMonths.add(m);selectedMonth=m;render();});
  const dialog = document.querySelector('#editor');
  const driverCard=document.querySelector('#driver-card');
  let currentDriver=drivers[0].id;
  let rangeMonth=selectedMonth, rangeStep=0, draftPeriods=[], selectedDraft=-1, changingDraft=-1, editorMode="view";
  function openEditor(id, period=null, fromCard=false) {
    editingPeriod=period;
    document.querySelector('#editor-title').textContent=drivers.find(d=>d.id===id).name+' — отпуска 2027';
    document.querySelector('#person').value=String(id);
    document.querySelector('#person').disabled=Boolean(period) || fromCard;
    document.querySelector('#person').closest('label').hidden=Boolean(period) || fromCard;
    document.querySelector('#start').value=period?period.start:'';
    document.querySelector('#end').value=period?period.end:'';
    rangeStep=0;selectedDraft=-1;changingDraft=-1;editorMode="view";
    draftPeriods=period?[{start:period.start,end:period.end}]:periodsFor(id).map(p=>({start:p.start,end:p.end}));
    document.querySelector('#start').value='';document.querySelector('#end').value='';
    drawRangeCalendar();
    document.querySelector('#form-error').textContent='';
    updateEditorMode();
    updateCount();
    dialog.showModal();
  }
  function showDriver(id) {
    currentDriver=id;
    const driver=drivers.find(d=>d.id===id);
    document.querySelector('#driver-title').textContent='Отпуска: '+driver.name;
    document.querySelector('#period-list').innerHTML=periodList(id);
    const planned=periodsFor(id).reduce((sum,p)=>sum+leaveDays(p.start,p.end),0);
    document.querySelector('#period-total').textContent='Положено: '+driver.allowance+' · Запланировано: '+planned+' · Осталось: '+(driver.allowance-planned)+' дн. (праздники исключены)';
    document.querySelector('#driver-add').disabled=planned>=driver.allowance;
    document.querySelector('#driver-add').title=planned>=driver.allowance?'Все дни отпуска уже запланированы':'';
    document.querySelector('#split-rule').innerHTML=splitRule(id);
    document.querySelectorAll('[data-edit]').forEach(el=>el.onclick=()=>{
      const p=periodsFor(id)[Number(el.dataset.edit)];
      driverCard.close(); openEditor(id,p,true);
    });
    document.querySelectorAll('[data-remove]').forEach(el=>el.onclick=()=>{
      const p=periodsFor(id)[Number(el.dataset.remove)];
      if (!confirm('Удалить период '+displayDate(p.start)+' — '+displayDate(p.end)+'?')) return;
      const index=vacations.indexOf(p);
      if(index>=0) vacations.splice(index,1);
      store(); notice='Период удалён.'; driverCard.close(); render();
    });
    driverCard.showModal();
  }
  document.querySelector('#period').onclick=()=>openEditor(drivers[0].id);
  document.querySelector('#person').onchange=()=>{draftPeriods=periodsFor(Number(document.querySelector('#person').value)).map(p=>({start:p.start,end:p.end}));rangeStep=0;drawRangeCalendar();updateCount();};
  document.querySelectorAll('[data-driver]').forEach(el=>el.onclick=()=>openEditor(Number(el.dataset.driver),null,true));
  document.querySelector('#driver-close').onclick=()=>driverCard.close();
  document.querySelector('#driver-add').onclick=()=>{driverCard.close();openEditor(currentDriver,null,true);};
  function updateEditorMode(){
    document.querySelector('#mode-add').disabled=editorMode==='add';
    document.querySelector('#mode-edit').disabled=editorMode==='edit';
    document.querySelector('#mode-delete').disabled=editorMode==='delete';
    document.querySelector('#vacation-form button[type="submit"]').hidden=editorMode==='view';
    document.querySelector('#range-hint').textContent=editorMode==='view'?'Просмотр отпусков. Для изменений нажмите кнопку выше.':editorMode==='add'?'Выберите начало и окончание нового периода.':editorMode==='edit'?'Нажмите на существующий отпуск для изменения дат.':'Нажмите на период, который нужно удалить.';
  }
  function setEditorMode(mode){
    editorMode=mode;rangeStep=0;changingDraft=-1;selectedDraft=-1;
    document.querySelector('#start').value='';document.querySelector('#end').value='';
    drawRangeCalendar();updateEditorMode();updateCount();
  }
  document.querySelector('#mode-add').onclick=()=>setEditorMode('add');
  document.querySelector('#mode-edit').onclick=()=>setEditorMode('edit');
  document.querySelector('#mode-delete').onclick=()=>setEditorMode('delete');
  function updateCount() {
    const id=Number(document.querySelector('#person').value);
    const driver=drivers.find(d=>d.id===id);
    const existing=editingPeriod?periodsFor(id).filter(p=>p!==editingPeriod):[];
    const combined=editingPeriod?existing.concat(draftPeriods):draftPeriods;
    const planned=combined.reduce((sum,p)=>sum+leaveDays(p.start,p.end),0);
    const remain=(driver?.allowance||36)-planned;
    document.querySelector('#day-count').textContent='Положено: '+(driver?.allowance||36)+' · Запланировано: '+planned+' · Осталось: '+remain+' дн.';
    document.querySelector('#editor-split-warning').textContent=combined.length>0&&!combined.some(p=>leaveDays(p.start,p.end)>=14)?'⚠ Нет ни одной части отпуска продолжительностью не менее 14 дней. Перед утверждением графика необходимо исправить.':'';
    document.querySelector('#form-error').textContent=remain<0?'Превышена продолжительность отпуска. Уменьшите периоды.':'';
    document.querySelector('#vacation-form button[type="submit"]').disabled=editorMode==='view'||remain<0||!draftPeriods.length;
  }
  function drawRangeCalendar() {
    const start=document.querySelector('#start').value,end=document.querySelector('#end').value;
    let html='';
    for(let month=0;month<12;month++){
      const first=new Date(Date.UTC(2027,month,1)).getUTCDay();
      const offset=(first+6)%7;
      const count=new Date(Date.UTC(2027,month+1,0)).getUTCDate();
      let cells=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(x=>'<span class="range-weekday">'+x+'</span>').join('');
      for(let i=0;i<offset;i++) cells+='<span></span>';
      for(let i=1;i<=count;i++){
        const date='2027-'+String(month+1).padStart(2,'0')+'-'+String(i).padStart(2,'0');
        const selected=draftPeriods.some(p=>date>=p.start&&date<=p.end)||(start&&end?date>=start&&date<=end:date===start);
        cells+='<button type="button" data-range-date="'+date+'" class="'+(selected?'range-active ':'')+(dayType(date)==='holiday'?'range-holiday':dayType(date)==='weekend'?'range-weekend':'')+'">'+i+'</button>';
      }
      html+='<section class="range-month"><h3>'+months[month]+'</h3><div class="range-month-days">'+cells+'</div></section>';
    }
    document.querySelector('#range-calendar').innerHTML=html;
    document.querySelector('#range-selected').textContent=editorMode==='view'?'Периоды отпуска':editorMode==='add'?'Добавление периода':editorMode==='edit'?'Выберите период для изменения':'Выберите период для удаления';
    document.querySelector('#range-periods').innerHTML=draftPeriods.map((p,i)=>'<div class="draft-period '+(selectedDraft===i?'draft-selected':'')+'"><button type="button" class="period-choice" data-period-choice="'+i+'" '+(editorMode==='edit'||editorMode==='delete'?'':'disabled')+'>'+(i+1)+'. '+displayDate(p.start)+' — '+displayDate(p.end)+' · '+leaveDays(p.start,p.end)+' дн.</button></div>').join('');
    document.querySelector('#range-hint').textContent=editorMode==='view'?'Просмотр отпусков. Для изменений нажмите кнопку выше.':rangeStep===1?'Выберите окончание периода.':changingDraft>=0?'Выберите новые начало и окончание.':editorMode==='add'?'Выберите начало нового периода.':editorMode==='edit'?'Нажмите на существующий период для изменения.':'Нажмите на период для удаления.';
    document.querySelectorAll('[data-period-choice]').forEach(b=>b.onclick=()=>{
      const i=Number(b.dataset.periodChoice),p=draftPeriods[i];
      if(!p)return;
      if(editorMode==='edit'){
        selectedDraft=i;changingDraft=i;rangeStep=0;
        document.querySelector('#start').value='';document.querySelector('#end').value='';
        drawRangeCalendar();updateCount();
      }else if(editorMode==='delete'){
        if(!confirm('Удалить период '+displayDate(p.start)+' — '+displayDate(p.end)+'?'))return;
        draftPeriods.splice(i,1);selectedDraft=-1;changingDraft=-1;rangeStep=0;
        drawRangeCalendar();updateCount();
      }
    });
    document.querySelectorAll('[data-range-date]').forEach(b=>b.onclick=()=>{
      const date=b.dataset.rangeDate;
      if(editorMode==='view')return;
      if(editorMode==='delete'){const i=draftPeriods.findIndex(p=>date>=p.start&&date<=p.end);if(i<0)return;if(!confirm('Удалить период '+displayDate(draftPeriods[i].start)+' — '+displayDate(draftPeriods[i].end)+'?'))return;draftPeriods.splice(i,1);drawRangeCalendar();updateCount();return;}
      if(editorMode==='edit'&&changingDraft<0&&rangeStep===0&& !draftPeriods.some(p=>date>=p.start&&date<=p.end))return;
      if(rangeStep!==1 && changingDraft<0 && editorMode==='edit'){const found=draftPeriods.findIndex(p=>date>=p.start&&date<=p.end);if(found>=0){selectedDraft=found;changingDraft=found;drawRangeCalendar();updateCount();return;}}
      if(rangeStep!==1){document.querySelector('#start').value=date;document.querySelector('#end').value='';rangeStep=1;}
      else {
        const a=document.querySelector('#start').value;
        document.querySelector('#start').value=date<a?date:a;
        document.querySelector('#end').value=date<a?a:date;
        const proposed={start:document.querySelector('#start').value,end:document.querySelector('#end').value};
        if(draftPeriods.some((p,i)=>i!==changingDraft&&proposed.start<=p.end&&proposed.end>=p.start)){document.querySelector('#form-error').textContent='Периоды не должны пересекаться.';return;}
        if(changingDraft>=0)draftPeriods[changingDraft]=proposed;else draftPeriods.push(proposed);
        changingDraft=-1;selectedDraft=-1;
        document.querySelector('#start').value='';document.querySelector('#end').value='';
        rangeStep=0;
      }
      drawRangeCalendar();updateCount();
    });
  }
  document.querySelector('#cancel').onclick=()=>dialog.close();
  document.querySelector('#vacation-form').onsubmit=e=>{
    e.preventDefault();
    const id=Number(document.querySelector('#person').value);
    if(editorMode==='view')return;
    if(rangeStep===1||changingDraft>=0){document.querySelector('#form-error').textContent='Завершите выбор периода.';return;}
    const original=periodsFor(id);
    const proposed=editingPeriod?original.filter(p=>p!==editingPeriod).concat(draftPeriods):draftPeriods;
    const sorted=[...proposed].sort((x,y)=>x.start.localeCompare(y.start));
    if(sorted.some((p,i)=>i>0&&p.start<=sorted[i-1].end)){document.querySelector('#form-error').textContent='Периоды пересекаются.';return;}
    const driver=drivers.find(d=>d.id===id);
    if(sorted.reduce((n,p)=>n+leaveDays(p.start,p.end),0)>driver.allowance){document.querySelector('#form-error').textContent='Превышена норма отпуска.';return;}
    vacations=vacations.filter(v=>Number(v.driverId)!==id).concat(sorted.map(p=>({driverId:id,start:p.start,end:p.end})));
    store();
    notice='Период отпуска сохранён.';
    dialog.close();
    render();
  };
  document.querySelectorAll('[data-date]').forEach(cell=>cell.onclick=()=>openEditor(Number(cell.dataset.id),null,true));
}
render();
