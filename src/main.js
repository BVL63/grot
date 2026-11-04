import './style.css';

const app = document.querySelector('#app');
const months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const drivers = [
  { id: 1, name: 'Иванов И.И.', group: '9' },
  { id: 2, name: 'Петров П.П.', group: '9' },
  { id: 3, name: 'Сидоров С.С.', group: '9.1' }
];
const key = 'vacations2027';
let selectedMonth = 0;
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
  const count = new Date(2027, selectedMonth+1, 0).getDate();
  const sets = new Map(drivers.map(d => [d.id, daysFor(d.id)]));
  app.innerHTML = `
    <header><h1>График отпусков — 2027</h1><p>Планирование отпусков водителей</p></header>
    <main>
      <div class="toolbar"><label>Месяц: <select id="month">${months.map((m,i) => `<option value="${i}" ${i===selectedMonth?'selected':''}>${m}</option>`).join('')}</select></label>
      <button id="period">Добавить период отпуска</button><button id="help-open" type="button">Справка · Правила отпусков</button><button id="calendar-open" type="button">Производственный календарь</button></div>
      <div class="scroll"><table>
        <thead><tr><th class="fixed name">Водитель</th><th class="fixed group">Группа</th>
          ${Array.from({length:count},(_,i)=>`<th class="${dayType(dateAt(i+1))==='weekend'?'weekend':''} ${dayType(dateAt(i+1))==='holiday'?'holiday':''}">${i+1}</th>`).join('')}</tr></thead>
        <tbody>${drivers.map(d => `<tr><th class="fixed name"><button class="driver" data-driver="${d.id}">${d.name}</button></th><td class="fixed group">${d.group}</td>
          ${Array.from({length:count},(_,i)=>{
            const date=dateAt(i+1);
            const active=sets.get(d.id).has(date);
            const weekend=dayType(date)==='weekend'; const holiday=dayType(date)==='holiday';
            return `<td class="day ${active?'vacation':''} ${weekend?'weekend':''} ${holiday?'holiday':''}" data-id="${d.id}" data-date="${date}" title="${d.name}: ${date}">${i+1}</td>`;
          }).join('')}</tr>`).join('')}</tbody>
        <tfoot><tr><th class="fixed name">В отпуске</th><td class="fixed group"></td>
          ${Array.from({length:count},(_,i)=>`<td>${drivers.filter(d=>sets.get(d.id).has(dateAt(i+1))).length}</td>`).join('')}</tr></tfoot>
      </table></div>
      <p>Нажмите на день для отметки или снятия отпуска. Нажмите на фамилию для ввода периода.</p>
      <p class="notice" role="status">${notice}</p>
      <p class="muted">Тестовая версия: данные хранятся только в этом браузере, не в облаке.</p>
    </main>
    <dialog id="editor"><form id="vacation-form">
      <h2 id="editor-title">Добавить период отпуска</h2>
      <label>Водитель <select id="person">${drivers.map(d=>`<option value="${d.id}">${d.name} — группа ${d.group}</option>`).join('')}</select></label>
      <label>Начало <input id="start" type="date" min="2027-01-01" max="2027-12-31" required></label>
      <label>Окончание <input id="end" type="date" min="2027-01-01" max="2027-12-31" required></label>
      <div id="day-count" class="day-count" aria-live="polite"></div><p class="muted">Добавление создаёт новый период. Изменение заменяет выбранный период.</p>
      <p id="form-error" role="alert"></p>
      <div class="actions"><button type="button" id="cancel">Отмена</button><button type="submit">Сохранить</button></div>
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
  document.querySelector('#month').onchange = e => {selectedMonth=Number(e.target.value);render();};
  const dialog = document.querySelector('#editor');
  const driverCard=document.querySelector('#driver-card');
  let currentDriver=drivers[0].id;
  function openEditor(id, period=null, fromCard=false) {
    editingPeriod=period;
    document.querySelector('#editor-title').textContent=period?'Изменить период отпуска':'Добавить период отпуска';
    document.querySelector('#person').value=String(id);
    document.querySelector('#person').disabled=Boolean(period) || fromCard;
    document.querySelector('#person').closest('label').hidden=Boolean(period) || fromCard;
    document.querySelector('#start').value=period?period.start:dateAt(1);
    document.querySelector('#end').value=period?period.end:dateAt(Math.min(14,count));
    document.querySelector('#form-error').textContent='';
    document.querySelector('#end').min=document.querySelector('#start').value;
    updateCount();
    dialog.showModal();
  }
  function showDriver(id) {
    currentDriver=id;
    const driver=drivers.find(d=>d.id===id);
    document.querySelector('#driver-title').textContent='Отпуска: '+driver.name;
    document.querySelector('#period-list').innerHTML=periodList(id);
    document.querySelector('#period-total').textContent='Итого дней отпуска: '+periodsFor(id).reduce((sum,p)=>sum+leaveDays(p.start,p.end),0)+' (праздники исключены)';
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
  document.querySelectorAll('[data-driver]').forEach(el=>el.onclick=()=>showDriver(Number(el.dataset.driver)));
  document.querySelector('#driver-close').onclick=()=>driverCard.close();
  document.querySelector('#driver-add').onclick=()=>{driverCard.close();openEditor(currentDriver,null,true);};
  function updateCount() {
    const start=document.querySelector('#start').value, end=document.querySelector('#end').value;
    const out=document.querySelector('#day-count');
    if (!start || !end || end<start) { out.textContent='Проверьте даты периода'; return; }
    const total=calendarDays({start,end});
    const leave=leaveDays(start,end);
    out.textContent='Дней в периоде: '+total+'. Дней оплачиваемого отпуска: '+leave+(total!==leave?' (праздники: '+(total-leave)+')':'')+'.';
  }
  document.querySelector('#start').addEventListener('change',()=>{
    const startInput=document.querySelector('#start');
    const endInput=document.querySelector('#end');
    if (!startInput.value) return updateCount();
    if (!editingPeriod || !endInput.value || endInput.value < startInput.value) {
      endInput.value=startInput.value;
    }
    endInput.min=startInput.value;
    updateCount();
  });
  document.querySelector('#end').addEventListener('change',updateCount);
  document.querySelector('#cancel').onclick=()=>dialog.close();
  document.querySelector('#vacation-form').onsubmit=e=>{
    e.preventDefault();
    const id=Number(document.querySelector('#person').value);
    const start=document.querySelector('#start').value, end=document.querySelector('#end').value;
    if (!start.startsWith('2027-') || !end.startsWith('2027-') || start>end) {
      document.querySelector('#form-error').textContent='Проверьте даты: начало должно быть не позже окончания, обе даты — в 2027 году.';
      return;
    }
    if (editingPeriod) {
      const idx=vacations.indexOf(editingPeriod);
      if(idx>=0) vacations.splice(idx,1);
    }
    const set=daysFor(id);
    for(let d=start,n=0;d<=end && n<366;d=shift(d,1),n++) set.add(d);
    replaceDays(id,set);
    notice='Период отпуска сохранён.';
    dialog.close();
    render();
  };
  document.querySelectorAll('[data-date]').forEach(cell=>cell.onclick=()=>{
    const id=Number(cell.dataset.id), date=cell.dataset.date;
    const set=daysFor(id);
    if(set.has(date)) set.delete(date); else set.add(date);
    replaceDays(id,set);
    notice='';
    render();
  });
}
render();
