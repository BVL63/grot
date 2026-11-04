
import './style.css';

const app = document.querySelector('#app');
const months = [
  'Январь','Февраль','Март','Апрель',
  'Май','Июнь','Июль','Август',
  'Сентябрь','Октябрь','Ноябрь','Декабрь'
];

const drivers = [
  { id: 1, name: 'Иванов И.И.', group: '9' },
  { id: 2, name: 'Петров П.П.', group: '9' },
  { id: 3, name: 'Сидоров С.С.', group: '9.1' }
];

let selectedMonth = 0;
let vacations = JSON.parse(
  localStorage.getItem('vacations2027') || '[]'
);

function save() {
  localStorage.setItem('vacations2027', JSON.stringify(vacations));
}

function render() {
  const days = new Date(2027, selectedMonth + 1, 0).getDate();

  app.innerHTML = `
    <header>
      <h1>График отпусков — 2027</h1>
      <p>Планирование отпусков водителей</p>
    </header>
    <main>
      <label>Месяц:
        <select id="month">
          ${months.map((m,i) =>
            `<option value="${i}" ${i === selectedMonth ? 'selected' : ''}>${m}</option>`
          ).join('')}
        </select>
      </label>
      <div class="scroll">
        <table>
          <thead><tr><th>Водитель</th><th>Группа</th>
            ${Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join('')}
          </tr></thead>
          <tbody>
            ${drivers.map(d=>`
              <tr><td>${d.name}</td><td>${d.group}</td>
                ${Array.from({length:days},(_,i)=>{
                  const day=i+1;
                  const date=`2027-${String(selectedMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                  const active=vacations.some(v=>v.driverId===d.id && date>=v.start && date<=v.end);
                  return `<td class="${active?'vacation':''}" data-id="${d.id}" data-date="${date}">${day}</td>`;
                }).join('')}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <p>Нажмите на день, чтобы отметить или снять отпуск.</p>
      <p>Данные этой тестовой версии хранятся только в браузере.</p>
    </main>`;

  document.querySelector('#month').onchange = e => {
    selectedMonth=Number(e.target.value);
    render();
  };

  document.querySelectorAll('[data-date]').forEach(cell=>{
    cell.onclick=()=>{
      const id=Number(cell.dataset.id);
      const date=cell.dataset.date;
      const index=vacations.findIndex(v=>v.driverId===id && v.start===date && v.end===date);
      if(index>=0) vacations.splice(index,1);
      else vacations.push({driverId:id,start:date,end:date});
      save();
      render();
    };
  });
}

render();
