import {buildUnifiedYearView,renderUnifiedYearTable} from './unifiedYearTableV2.js';
import {addVacationPeriod,editVacationPeriod,removeVacationPeriod} from './vacationEditorV2.js';
import {previewLegacyMigration} from './vacationModelV2.js';
import './v2Preview.css';

const root=document.querySelector('#v2-root');
const years=[2025,2026,2027,2028];
const sampleStaff=[
 {id:'1',name:'Иванов Иван Иванович'},
 {id:'2',name:'Петров Пётр Петрович'},
 {id:'3',name:'Сидоров Сергей Сергеевич'}
];
let staff=sampleStaff.map(x=>({...x}));
let records=[
 {id:'demo-1',year:2026,chartId:null,staffId:'1',staffName:staff[0].name,period:{start:'2026-06-15',end:'2026-06-28'},audit:[]},
 {id:'demo-2',year:2027,chartId:null,staffId:'1',staffName:staff[0].name,period:{start:'2027-07-15',end:'2027-07-28'},audit:[]},
 {id:'demo-3',year:2027,chartId:null,staffId:'2',staffName:staff[1].name,period:{start:'2027-08-10',end:'2027-08-23'},audit:[]}
];
let year=2027,selected=null,dirty=false,loadedSource='Демонстрационные данные';
const q=selector=>root.querySelector(selector);
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const editPolicy=()=>({year,readOnly:false,canEditPlan:true,canCorrect:true});
function dateFmt(s){return s?s.slice(8)+'.'+s.slice(5,7)+'.'+s.slice(0,4):'—';}
function draw(){
 const active=records.filter(r=>!r.deleted);
 root.innerHTML=`
  <header class="v2-header"><div><strong>ГРАФИК ОТПУСКОВ</strong>
   <small>ГРОТ 2.0 · отдельный пробный экран</small></div>
   <label>Год <select id="v2-year">${years.map(y=>`<option value="${y}" ${y===year?'selected':''}>${y}</option>`).join('')}</select></label>
  </header>
  <main>
   <p class="warning"><strong>Только тестирование:</strong> изменения действуют в памяти этой страницы,
   исходный ГРОТ и его хранилище не изменяются. Для сохранения результата используйте «Скачать JSON».</p>
   <div class="toolbar">
    <button id="v2-add">Добавить период</button>
    <button id="v2-import">Загрузить JSON для просмотра</button>
    <button id="v2-export">Скачать JSON</button>
    <span class="muted">${escapeHtml(loadedSource)} · ${dirty?'есть несохранённые изменения':'нет изменений'}</span>
   </div>
   <input id="v2-file" type="file" accept=".json,application/json" hidden>
   <div class="table-wrap">${renderUnifiedYearTable(buildUnifiedYearView(year,active,staff))}</div>
   <section id="v2-history"><h2>История изменений</h2><p>Выберите период в таблице для просмотра истории.</p></section>
  </main>
  <dialog id="v2-dialog">
   <form method="dialog" id="v2-editor">
    <h2 id="v2-dialog-title">Отпуск</h2>
    <label>Сотрудник <select name="staffId" required>${staff.map(p=>`<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join('')}</select></label>
    <label>Начало <input name="start" type="date" required></label>
    <label>Конец <input name="end" type="date" required></label>
    <label>Причина изменения <input name="reason" required placeholder="Например, корректировка графика"></label>
    <p id="v2-error" role="alert"></p>
    <div class="actions"><button type="button" id="v2-save">Сохранить</button>
    <button type="button" id="v2-delete">Удалить</button>
    <button type="button" id="v2-close">Закрыть</button></div>
   </form>
  </dialog>
  <footer>ГРОТ 2.0 — демонстрация · основной график не затронут</footer>`;
 q('#v2-year').onchange=e=>{year=Number(e.target.value);selected=null;draw();};
 q('#v2-add').onclick=()=>openEditor(null);
 q('#v2-import').onclick=()=>q('#v2-file').click();
 q('#v2-file').onchange=importJson;
 q('#v2-export').onclick=exportJson;
 q('.table-wrap').addEventListener('click',e=>{
  const node=e.target.closest('[data-period-id]');
  if(!node)return;
  const id=node.dataset.periodId;
  selected=records.find(r=>String(r.id)===id)||null;
  if(selected){showHistory(selected);openEditor(selected);}
 });
}
function showHistory(rec){
 const section=q('#v2-history');
 if(!section)return;
 const rows=(rec.audit||[]).map(a=>'<tr><td>'+escapeHtml(a.at)+'</td><td>'+escapeHtml(a.actor)+
 '</td><td>'+escapeHtml(a.reason)+'</td><td>'+
 escapeHtml(a.previous?.start||'—')+' – '+escapeHtml(a.previous?.end||'—')+
 '</td><td>'+escapeHtml(a.next?.start||'—')+' – '+escapeHtml(a.next?.end||'—')+'</td></tr>').join('');
 section.innerHTML='<h2>История изменений</h2><p>'+escapeHtml(rec.staffName||'')+
 ' · '+escapeHtml(rec.id)+'</p><div class="table-wrap"><table><thead><tr>'+
 '<th>Когда</th><th>Кто</th><th>Причина</th><th>Было</th><th>Стало</th></tr></thead>'+
 '<tbody>'+ (rows||'<tr><td colspan="5">Изменений пока нет</td></tr>')+'</tbody></table></div>';
}
function openEditor(rec){
 selected=rec;
 const form=q('#v2-editor');
 q('#v2-dialog-title').textContent=rec?'Изменить период':'Добавить период';
 form.elements.staffId.value=rec?.staffId||staff[0]?.id||'';
 form.elements.staffId.disabled=!!rec;
 form.elements.start.value=rec?.period.start||'';
 form.elements.end.value=rec?.period.end||'';
 form.elements.reason.value='';
 q('#v2-error').textContent='';
 q('#v2-delete').hidden=!rec;
 q('#v2-save').onclick=()=>{
  try{
   const meta={actor:'Пользователь тестового экрана',reason:form.elements.reason.value.trim(),at:new Date().toISOString()};
   if(rec)records=editVacationPeriod(records,rec.id,{
    start:form.elements.start.value,end:form.elements.end.value},editPolicy(),meta);
   else{
    const person=staff.find(x=>x.id===form.elements.staffId.value);
    if(!person)throw new Error('Выберите сотрудника');
    const id='preview-'+(globalThis.crypto?.randomUUID?.()||String(Date.now())+'-'+records.length);
    records=addVacationPeriod(records,{
     id,year,staffId:person.id,staffName:person.name,chartId:null,
     start:form.elements.start.value,end:form.elements.end.value},editPolicy(),meta);
   }
   dirty=true;q('#v2-dialog').close();draw();
  }catch(err){q('#v2-error').textContent=err.message;}
 };
 q('#v2-delete').onclick=()=>{
  try{
   const reason=form.elements.reason.value.trim();
   if(!reason)throw new Error('Укажите причину удаления');
   records=removeVacationPeriod(records,rec.id,editPolicy(),{
    actor:'Пользователь тестового экрана',reason,at:new Date().toISOString()});
   dirty=true;q('#v2-dialog').close();draw();
  }catch(err){q('#v2-error').textContent=err.message;}
 };
 q('#v2-close').onclick=()=>q('#v2-dialog').close();
 q('#v2-dialog').showModal();
}
async function importJson(e){
 const file=e.target.files?.[0];
 if(!file)return;
 try{
  const data=JSON.parse(await file.text());
  if(Array.isArray(data.records)&&data.records.every(r=>r&&Number.isInteger(Number(r.year))&&r.period)){
   records=data.records.map(r=>({...r}));
   staff=Array.isArray(data.staff)?data.staff.map(p=>({...p})):staff;
  }else if(Array.isArray(data.working2027)&&Array.isArray(data.history)){
   const preview=previewLegacyMigration(data);
   if(preview.warnings.length)throw new Error('Неоднозначные данные: '+preview.warnings.slice(0,3).join('; '));
   records=preview.records;
   staff=Array.isArray(data.staff)?data.staff:staff;
  }else throw new Error('Неподдерживаемый формат. Нужен JSON с records и staff или working2027/history/staff.');
  loadedSource='Файл: '+file.name;dirty=false;selected=null;draw();
 }catch(err){alert('Импорт не выполнен: '+err.message);}
}
function exportJson(){
 const data=JSON.stringify({schemaVersion:2,staff,records},null,2);
 const url=URL.createObjectURL(new Blob([data],{type:'application/json;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download='grot-v2-preview-'+year+'.json';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
 dirty=false;draw();
}
draw();
