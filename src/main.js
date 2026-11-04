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
let editingDriver = null;
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
      <button id="period">Добавить период отпуска</button></div>
      <div class="scroll"><table>
        <thead><tr><th class="fixed name">Водитель</th><th class="fixed group">Группа</th>
          ${Array.from({length:count},(_,i)=>`<th class="${[0,6].includes(new Date(2027,selectedMonth,i+1).getDay())?'weekend':''}">${i+1}</th>`).join('')}</tr></thead>
        <tbody>${drivers.map(d => `<tr><th class="fixed name"><button class="driver" data-driver="${d.id}">${d.name}</button></th><td class="fixed group">${d.group}</td>
          ${Array.from({length:count},(_,i)=>{
            const date=dateAt(i+1);
            const active=sets.get(d.id).has(date);
            const weekend=[0,6].includes(new Date(2027,selectedMonth,i+1).getDay());
            return `<td class="day ${active?'vacation':''} ${weekend?'weekend':''}" data-id="${d.id}" data-date="${date}" title="${d.name}: ${date}">${i+1}</td>`;
          }).join('')}</tr>`).join('')}</tbody>
        <tfoot><tr><th class="fixed name">В отпуске</th><td class="fixed group"></td>
          ${Array.from({length:count},(_,i)=>`<td>${drivers.filter(d=>sets.get(d.id).has(dateAt(i+1))).length}</td>`).join('')}</tr></tfoot>
      </table></div>
      <p>Нажмите на день для отметки или снятия отпуска. Нажмите на фамилию для ввода периода.</p>
      <p class="notice" role="status">${notice}</p>
      <p class="muted">Тестовая версия: данные хранятся только в этом браузере, не в облаке.</p>
    </main>
    <dialog id="editor"><form id="vacation-form">
      <h2>Период отпуска</h2>
      <label>Водитель <select id="person">${drivers.map(d=>`<option value="${d.id}">${d.name} — группа ${d.group}</option>`).join('')}</select></label>
      <label>Начало <input id="start" type="date" min="2027-01-01" max="2027-12-31" required></label>
      <label>Окончание <input id="end" type="date" min="2027-01-01" max="2027-12-31" required></label>
      <p class="muted">Период добавляется к существующим отметкам. Для удаления отдельного дня нажмите на него в таблице.</p>
      <p id="form-error" role="alert"></p>
      <div class="actions"><button type="button" id="cancel">Отмена</button><button type="submit">Сохранить</button></div>
    </form></dialog>`;
  document.querySelector('#month').onchange = e => {selectedMonth=Number(e.target.value);render();};
  const dialog = document.querySelector('#editor');
  function openEditor(id) {
    document.querySelector('#person').value=String(id);
    document.querySelector('#start').value=dateAt(1);
    document.querySelector('#end').value=dateAt(Math.min(14,count));
    document.querySelector('#form-error').textContent='';
    dialog.showModal();
  }
  document.querySelector('#period').onclick=()=>openEditor(drivers[0].id);
  document.querySelectorAll('[data-driver]').forEach(el=>el.onclick=()=>openEditor(Number(el.dataset.driver)));
  document.querySelector('#cancel').onclick=()=>dialog.close();
  document.querySelector('#vacation-form').onsubmit=e=>{
    e.preventDefault();
    const id=Number(document.querySelector('#person').value);
    const start=document.querySelector('#start').value, end=document.querySelector('#end').value;
    if (!start.startsWith('2027-') || !end.startsWith('2027-') || start>end) {
      document.querySelector('#form-error').textContent='Проверьте даты: начало должно быть не позже окончания, обе даты — в 2027 году.';
      return;
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
