import './style.css';
import { seasonalityDialog, loadHistory, calculateSeasonality } from './seasonality.js';
let displayYear = 2027;
const APP_VERSION='0.3.88';
import grotLogo from '../IMG_0637.jpeg';

const app = document.querySelector('#app');
const months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const defaultDrivers = [
  { id: 1, name: 'Иванов И.И.', group: '9' },
  { id: 2, name: 'Петров П.П.', group: '9' },
  { id: 3, name: 'Сидоров С.С.', group: '9.1' }
];

const vacationChartsKey='grotVacationCharts';
let vacationCharts;
try{const stored=JSON.parse(localStorage.getItem(vacationChartsKey)||'null');vacationCharts=Array.isArray(stored)&&stored.length?stored:[{id:'legacy-2027',name:'Общий график',year:2027,staffIds:[],allStaff:true}]}catch{vacationCharts=[{id:'legacy-2027',name:'Общий график',year:2027,staffIds:[],allStaff:true}]}
let activeVacationChartId=localStorage.getItem('grotActiveVacationChart')||vacationCharts[0].id;
function activeVacationChart(){return vacationCharts.find(x=>x.id===activeVacationChartId)||vacationCharts[0]}
function saveVacationCharts(){localStorage.setItem(vacationChartsKey,JSON.stringify(vacationCharts));localStorage.setItem('grotActiveVacationChart',activeVacationChartId)}
function vacationChartOpen(){
 const dlg=document.querySelector('#vacation-charts-dialog');if(!dlg)return;
 const list=document.querySelector('#vacation-charts-list');
 list.innerHTML=vacationCharts.map(c=>'<tr data-chart-id="'+escapeHtml(c.id)+'"><td><button type="button" data-chart-open="'+escapeHtml(c.id)+'">'+escapeHtml(c.name)+'</button></td><td>'+c.year+'</td><td>'+(c.allStaff?'Все':c.staffIds.length)+'</td><td><button type="button" data-chart-edit="'+escapeHtml(c.id)+'" title="Изменить">✏️</button> <button type="button" data-chart-remove="'+escapeHtml(c.id)+'" title="Удалить график" '+(vacationCharts.length===1?'disabled':'')+'>🗑️</button></td></tr>').join('');
 list.querySelectorAll('[data-chart-open]').forEach(b=>b.onclick=()=>{activeVacationChartId=b.dataset.chartOpen;saveVacationCharts();dlg.close();selectedDriverIds=null;selectedGroups=null;render()});
 list.querySelectorAll('[data-chart-edit]').forEach(b=>b.onclick=()=>vacationChartEdit(b.dataset.chartEdit));
 list.querySelectorAll('[data-chart-remove]').forEach(b=>b.onclick=()=>{
  const chart=vacationCharts.find(c=>c.id===b.dataset.chartRemove);
  if(!chart||vacationCharts.length<=1)return;
  if(!confirm('Удалить график «'+chart.name+'»?\n\nСотрудники и периоды отпусков сохранятся. Состав графика можно восстановить из резервной копии.'))return;
  vacationCharts=vacationCharts.filter(c=>c.id!==chart.id);
  if(activeVacationChartId===chart.id)activeVacationChartId=vacationCharts[0].id;
  saveVacationCharts();
  const priorities=readPriorities();
  delete priorities[chart.id];
  localStorage.setItem(priorityKey,JSON.stringify(priorities));
  selectedDriverIds=null;selectedGroups=null;
  dlg.close();render();vacationChartOpen();
 });
 dlg.showModal();
}
function vacationChartEdit(id){
 const chart=vacationCharts.find(c=>c.id===id);
 const name=prompt('Название графика',chart?.name||'');if(name===null||!name.trim())return;
 const chosen=new Set(chart?.allStaff?drivers.map(d=>String(d.id)):(chart?.staffIds||[]).map(String));
 const dialog=document.querySelector('#vacation-chart-members-dialog');
 document.querySelector('#vacation-chart-name').textContent=name.trim();
 document.querySelector('#vacation-chart-members').innerHTML=drivers.slice().sort((a,b)=>shortStaffName(a).localeCompare(shortStaffName(b),'ru')).map(d=>'<label style="display:block;padding:5px"><input type="checkbox" value="'+d.id+'" '+(chosen.has(String(d.id))?'checked':'')+'> '+escapeHtml(shortStaffName(d))+' — '+escapeHtml(d.department||'')+'</label>').join('');
 document.querySelector('#vacation-chart-save').onclick=()=>{
  const ids=[...dialog.querySelectorAll('#vacation-chart-members input:checked')].map(e=>Number(e.value));
  if(chart){chart.name=name.trim();chart.staffIds=ids;chart.allStaff=false}
  else{const created={id:'chart-'+Date.now(),name:name.trim(),year:2027,staffIds:ids,allStaff:false};vacationCharts.push(created);activeVacationChartId=created.id}
  saveVacationCharts();dialog.close();document.querySelector('#vacation-charts-dialog').close();selectedDriverIds=null;selectedGroups=null;render();
 };
 dialog.showModal();
}

const staffKey='vacationStaff2027';
let drivers;
try { const stored=JSON.parse(localStorage.getItem(staffKey)||'null'); drivers=Array.isArray(stored)&&stored.length?stored:defaultDrivers.map(d=>({...d,allowance:36,department:''})); } catch { drivers=defaultDrivers.map(d=>({...d,allowance:36,department:''})); }
drivers=drivers.map(d=>({...d,allowance:Number.isFinite(Number(d.allowance))?Number(d.allowance):36}));
function availableLeaveDays(d){return Math.max(0,(Number(d.allowance)||0)+(Array.isArray(d.dayOperations)?d.dayOperations.reduce((sum,x)=>sum+(Number(x.days)||0),0):0));}
function staffParts(d){if(d.lastName)return {last:d.lastName,first:d.firstName||'',middle:d.middleName||''};const v=String(d.name||'').trim();const m=v.match(/^(.+?)\s+([А-ЯЁA-Z])\.\s*([А-ЯЁA-Z])\.$/i);return m?{last:m[1],first:m[2]+'.',middle:m[3]+'.'}:{last:v,first:'',middle:''};}
function shortStaffName(d){const p=staffParts(d);return p.last+((p.first&&p.middle)?' '+p.first[0].toUpperCase()+'.'+p.middle[0].toUpperCase()+'.':p.first?' '+p.first[0].toUpperCase()+'.':'');}
function compareGroupAndName(a,b){const ga=String(a.group??''),gb=String(b.group??'');return ga.localeCompare(gb,'ru',{numeric:true})||shortStaffName(a).localeCompare(shortStaffName(b),'ru');}
function isEligibleForYear(d,year){return !(d.dismissalDate&&d.dismissalDate<year+'-01-01')&&!(d.dismissed&&!d.dismissalDate);}
function openSeasonality(year){
  const chart=activeVacationChart();
  const members=drivers.filter(d=>chart.allStaff||(chart.staffIds||[]).map(String).includes(String(d.id)));
  const memberIds=new Set(members.map(d=>String(d.id)));
  const history=loadHistory();
  const rosterForYear=selectedYear=>{
    if(selectedYear===2027)return members.filter(d=>isEligibleForYear(d,selectedYear)&&(!d.hireDate||d.hireDate<=selectedYear+'-12-31')).map(shortStaffName);
    // Historical 2026 entries often contain surnames only; match them against selected employees.
    if(selectedYear===2026){
      const surnames=new Set(members.map(d=>staffParts(d).last.trim().toLocaleLowerCase('ru')));
      return [...new Set(history.filter(r=>Number(r.year)===2026&&surnames.has(String(r.driver).trim().split(/\s+/)[0].toLocaleLowerCase('ru'))).map(r=>r.driver))];
    }
    return [];
  };
  seasonalityDialog(
    vacations.filter(v=>memberIds.has(String(v.driverId))).map(v=>({...v,year:2027,driver:shortStaffName(drivers.find(d=>Number(d.id)===Number(v.driverId))||{})})),
    year,rosterForYear,chart.name
  );
}

const priorityKey='grotChartPriorities';
function readPriorities(){try{return JSON.parse(localStorage.getItem(priorityKey)||'{}')||{}}catch{return {}}}
function priorityForChart(){return readPriorities()[activeVacationChart().id]||null}
function calculateChartPriority(){
 const chart=activeVacationChart(),members=drivers.filter(d=>chart.allStaff||(chart.staffIds||[]).map(String).includes(String(d.id)));
 const history=loadHistory().filter(r=>Number(r.year)===2026);
 const mapped=members.map(d=>({d,records:history.filter(r=>String(r.driver||'').trim().split(/\s+/)[0].toLocaleLowerCase('ru')===staffParts(d).last.trim().toLocaleLowerCase('ru'))}));
 if(!members.length){alert('В графике нет сотрудников.');return}
 const missing=mapped.filter(x=>!x.records.length);
 const names=members.map(shortStaffName);
 const rows=mapped.flatMap(x=>x.records.map(r=>({...r,driver:shortStaffName(x.d)})));
 const result=calculateSeasonality(rows,2026,names);
 const byName=new Map(result.drivers.map(x=>[x.name,x]));
 const sorted=members.filter(d=>byName.has(shortStaffName(d))).map(d=>({id:String(d.id),name:shortStaffName(d),...byName.get(shortStaffName(d))})).sort((a,b)=>a.ipo-b.ipo||a.name.localeCompare(b.name,'ru'));
 let prev=null,rank=0;sorted.forEach((x,i)=>{if(prev===null||Math.abs(x.ipo-prev)>0.000001)rank=i+1;x.rank=rank;prev=x.ipo});
 const saved=readPriorities();saved[chart.id]={year:2026,staffIds:members.map(d=>String(d.id)).sort(),calculatedAt:new Date().toISOString(),incomplete:missing.length>0,entries:sorted};localStorage.setItem(priorityKey,JSON.stringify(saved));render();
 if(missing.length)alert('Предварительный расчёт выполнен для '+sorted.length+' из '+members.length+' сотрудников. Нет архивных данных за 2026 год: '+missing.map(x=>shortStaffName(x.d)).join(', ')+'. Для них приоритет не назначен.');
}
function showPriorityDetails(id){
 const data=priorityForChart(),entry=data?.entries.find(x=>x.id===String(id));if(!entry)return;
 const fmt=n=>Number.isFinite(n)?n.toFixed(2).replace('.',','):'—';
 alert(entry.name+'\nПриоритет № '+entry.rank+'\nРасчёт по отпускам '+data.year+' года\nКОН: '+fmt(entry.kon)+' %\nКСН: '+fmt(entry.ksn)+'\nКСНн: '+fmt(entry.ksnNormalized)+' %\nИПО: '+fmt(entry.ipo)+'\n\nИПО = 0,6 × КОН + 0,4 × КСНн. Меньший ИПО — выше приоритет. Законные преимущества учитываются отдельно.');
}


const positionsKey='grotPositions';
function getPositions(){try{const saved=JSON.parse(localStorage.getItem(positionsKey)||'[]');return [...new Set([...(Array.isArray(saved)?saved:[]),...drivers.map(d=>d.position).filter(Boolean)].map(x=>String(x).trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'))}catch{return [...new Set(drivers.map(d=>d.position).filter(Boolean))].sort()}}
function savePositions(values){localStorage.setItem(positionsKey,JSON.stringify([...new Set(values.map(x=>x.trim()).filter(Boolean))]))}
function updatePositionSuggestions(){const list=document.querySelector('#staff-position-options');if(list)list.innerHTML=getPositions().map(x=>'<option value="'+escapeHtml(x)+'"></option>').join('')}
function openPositionsDirectory(){
 const dlg=document.querySelector('#positions-dialog'),list=document.querySelector('#positions-list');
 const draw=()=>{list.innerHTML=getPositions().map(x=>'<div style="display:flex;align-items:center;gap:8px;padding:4px 0"><span style="flex:1">'+escapeHtml(x)+'</span><button type="button" data-position-remove="'+escapeHtml(x)+'" title="Удалить из справочника">×</button></div>').join('')||'<p>Должностей пока нет.</p>';
 list.querySelectorAll('[data-position-remove]').forEach(b=>b.onclick=()=>{const value=b.dataset.positionRemove;if(drivers.some(d=>d.position===value)){alert('Должность используется в карточках сотрудников. Сначала измените её там.');return}savePositions(getPositions().filter(x=>x!==value));draw();updatePositionSuggestions()})};
 document.querySelector('#positions-add').onclick=()=>{const input=document.querySelector('#positions-new'),value=input.value.trim();if(!value)return;savePositions([...getPositions(),value]);input.value='';draw();updatePositionSuggestions()};
 document.querySelector('#positions-close').onclick=()=>dlg.close();
 draw();dlg.showModal();
}

function saveStaff(){localStorage.setItem(staffKey,JSON.stringify(drivers));}


let backupDirectory=null;
const backupDirectoryDb=()=>new Promise((resolve,reject)=>{const req=indexedDB.open('grot-backup-settings',1);req.onupgradeneeded=()=>req.result.createObjectStore('settings');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
async function backupDirectoryStore(handle){try{const db=await backupDirectoryDb();await new Promise((resolve,reject)=>{const tx=db.transaction('settings','readwrite');tx.objectStore('settings').put(handle,'directory');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close()}catch(err){console.warn('Не удалось сохранить выбранную папку',err)}}
async function backupDirectoryLoad(){try{const db=await backupDirectoryDb();const handle=await new Promise((resolve,reject)=>{const req=db.transaction('settings','readonly').objectStore('settings').get('directory');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});db.close();backupDirectory=handle||null}catch{}return backupDirectory}
async function backupDirectoryChoose(){if(!window.showDirectoryPicker){alert('В этом браузере выбор постоянной папки не поддерживается. Используйте скачивание резервной копии.');return}try{backupDirectory=await window.showDirectoryPicker({mode:'readwrite'});await backupDirectoryStore(backupDirectory);backupDirectoryStatus()}catch(err){if(err.name!=='AbortError')alert('Не удалось выбрать папку: '+err.message)}}
function backupDirectoryStatus(){const el=document.querySelector('#backup-directory-status');if(el)el.textContent=backupDirectory?'Выбрана папка: '+backupDirectory.name:'Папка не выбрана. Используется стандартная загрузка файлов.'}
async function backupDirectoryPermission(mode){if(!backupDirectory)return false;try{const options={mode};if(await backupDirectory.queryPermission(options)==='granted')return true;return await backupDirectory.requestPermission(options)==='granted'}catch{return false}}
function backupSettingsOpen(){backupDirectoryStatus();document.querySelector('#backup-settings-dialog').showModal()}

const structureKey='grotEnterpriseStructure';
let structureNodes=[];
try{const v=JSON.parse(localStorage.getItem(structureKey)||'[]');structureNodes=Array.isArray(v)?v:[]}catch{}
const structureTypes={organization:'Организация',division:'Подразделение',department:'Отдел',brigade:'Группа (бригада)'};
const structureChildren={organization:['division'],division:['department','brigade'],department:['department','brigade'],brigade:[]};
const structureEscape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function structureAncestors(id){const result=[];const seen=new Set();let node=structureNodes.find(n=>n.id===id);while(node&&!seen.has(node.id)){seen.add(node.id);result.unshift(node);node=structureNodes.find(n=>n.id===node.parentId)}return result}
function structureEnsureOrganization(){
 const org=readOrganization();
 let roots=structureNodes.filter(n=>n.type==='organization');
 if(!roots.length){
  const root={id:'st-org-root',parentId:null,type:'organization',name:org.shortName||org.fullName,code:'01'};
  structureNodes.unshift(root);
  for(const n of structureNodes){if(n!==root&&!n.parentId)n.parentId=root.id}
 }else{
  const root=roots[0];root.parentId=null;
  for(const n of roots.slice(1)){
   for(const child of structureNodes)if(child.parentId===n.id)child.parentId=root.id;
   for(const d of drivers)if(d.structureId===n.id)d.structureId=root.id;
  }
  structureNodes=structureNodes.filter(n=>n===root||n.type!=='organization');
  root.name=org.shortName||org.fullName;
  if(!root.code)root.code='01';
  for(const n of structureNodes)if(n!==root&&!n.parentId)n.parentId=root.id;
 }
 localStorage.setItem(structureKey,JSON.stringify(structureNodes));
}
function structureDraw(){
 const root=document.querySelector('#structure-tree');if(!root)return;
 const selectedId=root.dataset.selectedId;
 const collapsed=new Set(JSON.parse(sessionStorage.getItem('grotStructureCollapsed')||'[]'));
 const countBranch=id=>{const visited=new Set();const ids=[id];for(let i=0;i<ids.length;i++){const current=ids[i];if(visited.has(current))continue;visited.add(current);for(const child of structureNodes)if(child.parentId===current&&!visited.has(child.id)&&!ids.includes(child.id))ids.push(child.id)}const counted=new Set(drivers.filter(d=>visited.has(d.structureId)).map(d=>String(d.id)));for(const node of structureNodes){if(visited.has(node.id)&&node.leaderId&&drivers.some(d=>String(d.id)===String(node.leaderId)))counted.add(String(node.leaderId))}return counted.size};
 const rows=(parent,level)=>structureNodes.filter(n=>n.parentId===parent).map(n=>{
 const children=structureNodes.some(x=>x.parentId===n.id);
 const peopleCount=countBranch(n.id);
 const toggle=children?'<button type="button" class="structure-toggle" data-toggle="'+structureEscape(n.id)+'" aria-label="Раскрыть или свернуть">'+(collapsed.has(n.id)?'＋':'−')+'</button>':'<span class="structure-toggle-placeholder"></span>';
 return '<tr class="structure-row '+(selectedId===n.id?'structure-selected':'')+'" data-id="'+structureEscape(n.id)+'"><td><div class="structure-name-cell" style="padding-left:'+(level*22+8)+'px">'+toggle+'<span class="structure-name-text">'+structureEscape(n.name)+'</span></div></td><td>'+structureEscape(n.code||'')+'</td><td>'+structureEscape(drivers.find(d=>String(d.id)===String(n.leaderId))?.name||'')+'</td><td>'+(peopleCount||'')+'</td></tr>'+(collapsed.has(n.id)?'':rows(n.id,level+1));
 }).join('');
 root.innerHTML='<table class="structure-table"><thead><tr><th>Наименование</th><th>Код</th><th>Руководитель</th><th>Сотрудников</th></tr></thead><tbody>'+rows(null,0)+'</tbody></table>';
 root.querySelectorAll('[data-toggle]').forEach(btn=>btn.onclick=e=>{e.stopPropagation();const id=btn.dataset.toggle;collapsed.has(id)?collapsed.delete(id):collapsed.add(id);sessionStorage.setItem('grotStructureCollapsed',JSON.stringify([...collapsed]));structureDraw()});
 root.querySelectorAll('.structure-row').forEach(tr=>{tr.onclick=e=>{if(e.target.closest('[data-toggle]'))return;root.dataset.selectedId=tr.dataset.id;structureDraw()};tr.ondblclick=e=>{if(!e.target.closest('[data-toggle]')){root.dataset.selectedId=tr.dataset.id;structureCard('view')}}});
 const n=structureSelected();const assigned=n?drivers.filter(d=>d.structureId===n.id):[];
 document.querySelector('#structure-current').textContent=n?'Закреплены: '+(assigned.map(shortStaffName).join(', ')||'нет сотрудников'):'Выберите элемент структуры';
}
function structureOpen(){structureEnsureOrganization();structureDraw();document.querySelector('#structure-dialog').showModal()}
function structureSelected(){return structureNodes.find(n=>n.id===document.querySelector('#structure-tree')?.dataset.selectedId)}
function structureNextCode(parentId){
 const parent=structureNodes.find(n=>n.id===parentId);
 const prefix=parent?(parent.code||''):'';
 const siblings=structureNodes.filter(n=>(n.parentId||null)===(parentId||null));
 const used=new Set(siblings.map(n=>String(n.code||'')));
 for(let i=1;i<10000;i++){const code=(prefix?prefix+'.':'')+String(i).padStart(2,'0');if(!used.has(code)&&!structureNodes.some(n=>n.code===code))return code}
 return '';
}
function structureCard(mode){
 const n=mode==='new'?null:structureSelected();
 if(mode!=='new'&&!n){alert('Выберите элемент структуры.');return}
 if(mode!=='new'&&n.type==='organization'){openOrganizationCard();return}
 const parent=mode==='new'?structureSelected():null;
 const types=parent?structureChildren[parent.type]:[];
 if(mode==='new'&&!types.length){alert('Сначала выберите организацию или подразделение, в котором создаётся новое звено.');return}
 const dlg=document.querySelector('#structure-card-dialog'),form=document.querySelector('#structure-card-form');
 form.reset();form.dataset.mode=mode;
 document.querySelector('#structure-card-title').textContent=mode==='new'?'Новое структурное звено':mode==='view'?'Просмотр структурного звена':'Изменение структурного звена';
 const typeSelect=document.querySelector('#structure-card-type');
 typeSelect.innerHTML=(mode==='new'?types:[n.type]).map(t=>'<option value="'+t+'">'+structureTypes[t]+'</option>').join('');
 document.querySelector('#structure-card-name').value=n?.name||'';
 document.querySelector('#structure-card-code').value=n?.code||structureNextCode(parent?.id||null);
 document.querySelector('#structure-card-parent').value=(mode==='new'?parent?.name:structureNodes.find(x=>x.id===n?.parentId)?.name)||'—';
 document.querySelector('#structure-card-title-position').value=n?.leaderTitle||'';
 const leader=document.querySelector('#structure-card-leader');
 leader.innerHTML='<option value="">Не назначен</option>'+drivers.map(d=>'<option value="'+structureEscape(d.id)+'">'+structureEscape(shortStaffName(d))+'</option>').join('');
 leader.value=n?.leaderId||'';
 [...form.querySelectorAll('input,select')].forEach(el=>el.disabled=mode==='view');
 document.querySelector('#structure-card-save').hidden=mode==='view';
 dlg.showModal();
}
function structureCardSave(e){
 e.preventDefault();const form=e.currentTarget,mode=form.dataset.mode;
 const name=document.querySelector('#structure-card-name').value.trim();if(!name)return;
 const n=mode==='new'?{id:'st-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),parentId:structureSelected()?.id||null,type:document.querySelector('#structure-card-type').value}:structureSelected();
 if(!n)return;
 const code=document.querySelector('#structure-card-code').value.trim();
 if(!code){alert('Укажите код структурного звена.');return}
 if(structureNodes.some(x=>x.id!==n.id&&x.code===code)){alert('Код «'+code+'» уже используется.');return}
 n.name=name;n.code=code;n.leaderTitle=document.querySelector('#structure-card-title-position').value.trim();n.leaderId=document.querySelector('#structure-card-leader').value;
 if(mode==='new')structureNodes.push(n);
 localStorage.setItem(structureKey,JSON.stringify(structureNodes));document.querySelector('#structure-card-dialog').close();structureDraw();
}
function structureAdd(){structureCard('new')}
function structureEdit(){structureCard('edit')}
function structureRemove(){
 const n=structureSelected();if(!n)return;
 if(structureNodes.some(x=>x.parentId===n.id)||drivers.some(d=>d.structureId===n.id)){alert('Сначала переместите сотрудников и удалите вложенные элементы.');return}
 if(n.type==='organization'){alert('Организацию нельзя удалить из структуры.');return}
 if(!confirm('Удалить «'+n.name+'»?'))return;
 structureNodes=structureNodes.filter(x=>x.id!==n.id);localStorage.setItem(structureKey,JSON.stringify(structureNodes));structureDraw();
}
function structureAssignOpen(){
 const n=structureSelected();if(!n){alert('Выберите подразделение, отдел или бригаду.');return}
 if(n.type==='organization'){alert('Выберите подразделение, отдел или бригаду.');return}
 const box=document.querySelector('#structure-employees');
 box.innerHTML=[...drivers].sort((a,b)=>shortStaffName(a).localeCompare(shortStaffName(b),'ru')).map(d=>'<label class="structure-person"><input type="checkbox" value="'+structureEscape(d.id)+'" '+(d.structureId===n.id?'checked':'')+'> '+structureEscape(shortStaffName(d))+' <small>'+structureEscape(d.department||'')+'</small></label>').join('');
 document.querySelector('#structure-assignment-title').textContent='Сотрудники: '+n.name;
 document.querySelector('#structure-assign-dialog').showModal();
}
function structureAssignSave(){
 const n=structureSelected();if(!n)return;
 const ids=new Set([...document.querySelectorAll('#structure-employees input:checked')].map(x=>String(x.value)));
 const hierarchy=structureAncestors(n.id);const division=hierarchy.find(x=>x.type==='division');
 for(const d of drivers){if(ids.has(String(d.id))){d.structureId=n.id;if(division)d.department=division.name}else if(d.structureId===n.id){d.structureId=null}}
 saveStaff();
 const selectedId=n.id;
 document.querySelector('#structure-assign-dialog').close();
 document.querySelector('#structure-dialog').close();
 render();
 const tree=document.querySelector('#structure-tree');tree.dataset.selectedId=selectedId;
 structureOpen();
}

const orgStorageKey='grotOrganization';
const orgDefaults={fullName:'Краевое государственное бюджетное учреждение здравоохранения «Владивостокская поликлиника № 9»',shortName:'КГБУЗ «Владивостокская поликлиника № 9»',inn:'2540192413',kpp:'254301001',ogrn:'1132540005971',okpo:'27866762',address:'690911, Приморский край, г. Владивосток, ул. Адмирала Горшкова, д. 3',director:'Беньковская Ольга Павловна',phone:'+7 (423) 278-85-44',email:'vladpolik9@mail.ru',website:'https://vladpol-9.ru'};
function readOrganization(){try{return {...orgDefaults,...JSON.parse(localStorage.getItem(orgStorageKey)||'{}')}}catch{return {...orgDefaults}}}
function openOrganizationCard(){
 let dlg=document.getElementById('grot-organization-dialog');
 if(!dlg){dlg=document.createElement('dialog');dlg.id='grot-organization-dialog';document.body.appendChild(dlg)}
 if(dlg.open)return;
 dlg.setAttribute('aria-labelledby','grot-org-title');
 const fields=[['fullName','Полное наименование'],['shortName','Краткое наименование'],['inn','ИНН'],['kpp','КПП'],['ogrn','ОГРН'],['okpo','ОКПО'],['address','Юридический адрес'],['director','Руководитель'],['phone','Телефон'],['email','Электронная почта'],['website','Сайт']];
 const org=readOrganization();
 const lengths={inn:10,kpp:9,ogrn:13,okpo:8};
 const field=(key,label)=>{ if(key==='fullName')label='Полное'; if(key==='shortName')label='Краткое';
  const value=escapeHtml(org[key]),required=['fullName','shortName'].includes(key)?' required':'';
  const attrs=' name="'+key+'" id="org-'+key+'"'+required;
  const control=['fullName','address'].includes(key)?'<textarea'+attrs+' rows="3">'+value+'</textarea>':'<input'+attrs+' value="'+value+'" type="'+({email:'email',website:'url',phone:'tel'}[key]||'text')+'"'+(lengths[key]?' inputmode="numeric" pattern="[0-9]{'+lengths[key]+'}" maxlength="'+lengths[key]+'" title="'+lengths[key]+' цифр"':'')+'>';
  return '<label class="org-field '+(['fullName','shortName','address','director','website'].includes(key)?'org-wide':'')+'"><span>'+label+'</span>'+control+(lengths[key]?'<small>'+lengths[key]+' цифр</small>':'')+'</label>';
 };
 const section=(title,keys)=>'<section class="org-section"><h3>'+title+'</h3><div class="org-fields">'+keys.map(k=>field(k,fields.find(x=>x[0]===k)[1])).join('')+'</div></section>';
 dlg.innerHTML='<form id="grot-org-form"><header class="org-dialog-header"><div><h2 id="grot-org-title">Организация</h2></div><button type="button" class="org-x" id="grot-org-x" aria-label="Закрыть карточку">×</button></header><div class="org-dialog-content">'+section('Наименование',['fullName','shortName'])+section('Регистрационные данные',['inn','kpp','ogrn','okpo'])+section('Адрес и руководство',['address','director'])+section('Контакты',['phone','email','website'])+'<p class="org-note">Реквизиты сохраняются в этом браузере. Перед использованием в документах сверьте их с данными организации.</p></div><footer class="org-dialog-footer"><p id="grot-org-status" role="status" aria-live="polite"></p><button type="button" id="grot-org-cancel">Закрыть</button><button type="submit" class="org-save">Сохранить</button></footer></form>';
 const form=dlg.querySelector('form'),status=dlg.querySelector('#grot-org-status');
 const values=()=>Object.fromEntries(fields.map(([key])=>[key,String(new FormData(form).get(key)||'').trim()]));
 let baseline=JSON.stringify(values());
 const close=()=>{if(JSON.stringify(values())!==baseline&&!window.confirm('Закрыть карточку без сохранения изменений?'))return;dlg.close()};
 dlg.querySelector('#grot-org-cancel').onclick=close;
 dlg.querySelector('#grot-org-x').onclick=close;
 dlg.oncancel=e=>{e.preventDefault();close()};
 form.oninput=()=>{status.textContent=JSON.stringify(values())===baseline?'':'Есть несохранённые изменения';status.className=''};
 form.onsubmit=e=>{
  e.preventDefault();
  if(!form.reportValidity())return;
  const data=values();
  try{localStorage.setItem(orgStorageKey,JSON.stringify(data));baseline=JSON.stringify(data);status.textContent='Изменения сохранены';status.className='org-success';refreshHeaderOrganization()}
  catch{status.textContent='Не удалось сохранить. Проверьте доступ к хранилищу браузера и повторите попытку.';status.className='org-error'}
 };
 const scrollY=window.scrollY;
 const previousBodyStyle={position:document.body.style.position,top:document.body.style.top,left:document.body.style.left,right:document.body.style.right,width:document.body.style.width};
 const unlock=()=>{Object.assign(document.body.style,previousBodyStyle);window.scrollTo(0,scrollY);dlg.removeEventListener('close',unlock)};
 dlg.addEventListener('close',unlock);
 Object.assign(document.body.style,{position:'fixed',top:'-'+scrollY+'px',left:'0',right:'0',width:'100%'});
 dlg.showModal();
}
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
function personnelExportRows(){
 return drivers.flatMap(d=>periodsFor(d.id).map((p,i)=>({
  department:d.department||'',name:[d.lastName,d.firstName,d.middleName].filter(Boolean).join(' ')||d.name||'',
  position:d.position||'Водитель автомобиля',personnel:d.personnelNumber||d.tabNumber||'',
  group:d.group||'',days:leaveDays(p.start,p.end),start:displayDate(p.start),end:displayDate(p.end),
  part:i+1
 }))).sort((a,b)=>a.department.localeCompare(b.department,'ru')||a.name.localeCompare(b.name,'ru')||a.part-b.part);
}
function personnelCsv(){
 const rows=personnelExportRows(),head=['Подразделение','ФИО','Должность','Табельный номер','Группа','Часть отпуска','Календарных дней без праздников','Начало','Окончание'];
 const safe=v=>{let t=String(v??'');if(/^[=+@-]/.test(t))t="'"+t;return '"'+t.replace(/"/g,'""')+'"';};
 const data=[head,...rows.map(r=>[r.department,r.name,r.position,r.personnel,r.group,'Часть '+r.part,r.days,r.start,r.end])];
 const blob=new Blob(['\\uFEFF'+data.map(r=>r.map(safe).join(';')).join('\\r\\n')],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='grot-kadry-2027.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function printGroupOverlaps(){
 const chart=activeVacationChart(),esc=escapeHtml;
 const members=drivers.filter(d=>(chart.allStaff||(chart.staffIds||[]).map(String).includes(String(d.id)))&&isEligibleForYear(d,2027));
 const matches=[];
 for(let i=0;i<members.length;i++)for(let j=i+1;j<members.length;j++){
  const a=members[i],b=members[j];
  if(!String(a.group||'').trim()||String(a.group||'')!==String(b.group||'')||String(a.department||'')!==String(b.department||''))continue;
  for(const pa of periodsFor(Number(a.id)))for(const pb of periodsFor(Number(b.id))){
   const start=pa.start>pb.start?pa.start:pb.start,end=pa.end<pb.end?pa.end:pb.end;
   if(start<=end)matches.push({department:a.department||'—',group:a.group||'—',a:shortStaffName(a),b:shortStaffName(b),start,end,days:leaveDays(start,end)});
  }
 }
 matches.sort((a,b)=>a.department.localeCompare(b.department,'ru')||String(a.group).localeCompare(String(b.group),'ru',{numeric:true})||a.start.localeCompare(b.start)||a.a.localeCompare(b.a,'ru'));
 const body=matches.map((x,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(x.a)+'</td><td>'+esc(x.b)+'</td><td>'+displayDate(x.start)+'</td><td>'+displayDate(x.end)+'</td><td>'+x.days+'</td></tr>').join('');
 const html='<html lang="ru"><head><meta charset="UTF-8"><title>Пересечения отпусков в группах — 2027</title><style>@page{size:A4 landscape;margin:12mm}body{font:12px Arial,sans-serif;color:#111}h2{text-align:center}table{width:100%;border-collapse:collapse}th,td{border:1px solid #555;padding:6px;vertical-align:middle}th{background:#eee}th:nth-child(4),th:nth-child(5),th:nth-child(6),td:nth-child(4),td:nth-child(5),td:nth-child(6){text-align:center}.toolbar{display:flex;gap:10px;justify-content:flex-end;margin-bottom:15px}.toolbar button{padding:8px 12px}.note{margin-top:15px;color:#444}@media print{.toolbar{display:none}thead{display:table-header-group}tr{break-inside:avoid}}</style></head><body><div class="toolbar"><button onclick="window.print()">Печать / PDF</button><button onclick="window.close()">Закрыть</button></div><h2>Пересечения отпусков в группах — 2027</h2><p>'+esc(readOrganization().shortName||readOrganization().fullName)+' · График: '+esc(chart.name)+'</p><p>Найдено пересечений: <b>'+matches.length+'</b></p>'+(matches.length?'<table><thead><tr><th>№</th><th>Сотрудник 1</th><th>Сотрудник 2</th><th>Начало</th><th>Окончание</th><th>Дней</th></tr></thead><tbody>'+body+'</tbody></table>':'<p>Пересечений отпусков внутри одинаковых групп и подразделений не обнаружено.</p>')+'<p class="note">Проверяются только сотрудники выбранного графика. Контроль пересечений действует только внутри одной непустой группы и одного подразделения. Сотрудники без группы могут пересекаться с любыми другими. Дни рассчитаны по правилам графика с исключением праздничных дней.</p></body></html>';
 const w=window.open('','_blank');if(!w){alert('Разрешите всплывающие окна для печати.');return}w.document.write(html);w.document.close();w.focus();
}
function printStaffDepartment(d){
 const hierarchy=d.structureId?structureAncestors(d.structureId):[];
 return hierarchy.filter(n=>n.type==='department').map(n=>n.name).filter(Boolean).join(' / ')||'—';
}
function printStaffDepartmentCode(d){
 const hierarchy=d.structureId?structureAncestors(d.structureId):[];
 return hierarchy.filter(n=>n.type==='department').map(n=>String(n.code||'').trim()).filter(Boolean).join('.')||'';
}
function printMonthlyVacationChart(year=displayYear){
 const chart=activeVacationChart(),esc=escapeHtml;
 const historic=year===2026?loadHistory().filter(p=>Number(p.year)===2026):[];
 const archiveMembers=year===2026?[...new Set(historic.map(p=>p.driver).filter(Boolean))].map((name,i)=>({id:'history-'+i,name,position:'',department:'',historicalPeriods:historic.filter(p=>p.driver===name)})):[];
 const members=(year===2026?archiveMembers:drivers.filter(d=>(chart.allStaff||(chart.staffIds||[]).map(String).includes(String(d.id)))&&isEligibleForYear(d,2027))).sort((a,b)=>{
  if(year===2026)return shortStaffName(a).localeCompare(shortStaffName(b),'ru');
  const ac=printStaffDepartmentCode(a),bc=printStaffDepartmentCode(b);
  return (!ac!==!bc?(ac? -1:1):ac.localeCompare(bc,'ru',{numeric:true}))||shortStaffName(a).localeCompare(shortStaffName(b),'ru');
 });
 const header=months.map(m=>'<th>'+esc(m.slice(0,3).toLowerCase())+'</th>').join('');
 const holidays2026=new Set(['2026-01-01','2026-01-02','2026-01-03','2026-01-04','2026-01-05','2026-01-06','2026-01-07','2026-01-08','2026-02-23','2026-03-08','2026-05-01','2026-05-09','2026-06-12','2026-11-04']);
 const printDays=(start,end)=>{if(year!==2026)return leaveDays(start,end);let n=0;for(let date=start,i=0;date<=end&&i<366;date=shift(date,1),i++)if(!holidays2026.has(date))n++;return n};
 const body=members.map((d,i)=>{
  const periods=(year===2026?d.historicalPeriods:periodsFor(Number(d.id))).filter(p=>p.start.slice(0,4)===String(year)&&p.end.slice(0,4)===String(year));
  // Укладываем непересекающиеся по месяцам периоды на один уровень.
  // Новая строка нужна только при занятом месяце (в том числе переходящим отпуском).
  const layers=[];
  for(const p of [...periods].sort((a,b)=>a.start.localeCompare(b.start))){
   const first=Number(p.start.slice(5,7))-1,last=Number(p.end.slice(5,7))-1;
   let layer=layers.find(items=>items.every(q=>Number(q.end.slice(5,7))-1<first || Number(q.start.slice(5,7))-1>last));
   if(!layer){layer=[];layers.push(layer)}
   layer.push(p);
  }
  if(!layers.length)layers.push([]);
  return layers.map((items,layer)=>{
    const prefix=layer===0?'<td class="num" rowspan="'+layers.length+'">'+(i+1)+'</td><td class="person" rowspan="'+layers.length+'"><b>'+esc(shortStaffName(d))+'</b><small>'+esc(d.position||'')+'</small><small>'+esc(year===2026?'Архив 2026':printStaffDepartment(d))+'</small></td>':'';
    const cells=[];
    for(let m=0;m<12;){
      const p=items.find(p=>Number(p.start.slice(5,7))-1===m);
      if(p){
        const span=Number(p.end.slice(5,7))-m;
        cells.push(span===1?'<td class="leave-print-single"><div class="leave-print-vertical"><div>'+esc(displayDate(p.start))+'</div><div>'+esc(displayDate(p.end))+'</div><strong>'+printDays(p.start,p.end)+' дн.</strong></div></td>':'<td class="leave-print-span" colspan="'+span+'"><div class="leave-print-dates">'+esc(displayDate(p.start))+'  –  '+esc(displayDate(p.end))+'</div><div class="leave-print-days">'+printDays(p.start,p.end)+' дн.</div></td>');
        m+=span;
      }else{cells.push('<td></td>');m++}
    }
    return '<tr class="leave-print-layer '+(layer===0?'leave-print-first ':'')+(layer===layers.length-1?'leave-print-last':'')+'">'+prefix+cells.join('')+(layer===0?'<td class="leave-print-total" rowspan="'+layers.length+'">'+periods.reduce((sum,item)=>sum+printDays(item.start,item.end),0)+'</td>':'')+'</tr>';
  }).join('');
 }).join('');
 const html='<html lang="ru"><head><meta charset="UTF-8"><title>График отпусков '+year+'</title><script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script><script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js"></script><script src="/grot/print-pagination.js"></script><style>@page{size:A4 landscape;margin:10mm}body{font:10px "Times New Roman",serif;color:#111}h1{text-align:center;font-size:19px;letter-spacing:3px;margin:10px 0 14px}.subtitle{text-align:center;font-size:12px;margin-bottom:12px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #333;padding:3px 2px;vertical-align:top;overflow-wrap:anywhere}th{background:#eee;text-align:center;vertical-align:middle}th:first-child,.num{text-align:center}td{height:24px}.leave-print-layer td{height:24px}.leave-print-layer:not(.leave-print-last) td:not([rowspan]){border-bottom:0}.leave-print-layer:not(.leave-print-first) td{border-top:0}.person,.num,.leave-print-total{vertical-align:middle}.num,.leave-print-total{text-align:center}.leave-print-total{font-weight:bold;font-size:11px}small{display:block;font-size:10px;margin-top:3px}hr{border:0;border-top:1px dotted #bbb}.toolbar{margin:0 0 12px;display:flex;gap:8px;justify-content:flex-end}.toolbar button{padding:8px 14px}.person b{font-size:11px}.document-title{background:white;font-size:19px;letter-spacing:3px;padding:10px 0 7px;border:0}.document-subtitle{background:white;font-size:12px;font-weight:normal;padding:0 0 10px;border:0}.leave-print-span{vertical-align:middle}.leave-print-dates{display:block;font-size:11px;font-weight:bold;white-space:pre;text-align:center}.leave-print-dates span:first-child{text-align:left}.leave-print-dates span:last-child{text-align:right}.leave-print-dash{flex:1;text-align:center;color:#555}.leave-print-days{text-align:center}.leave-print-days{text-align:center;margin-top:7px;font-size:11px;font-weight:bold}.leave-print-single{text-align:center}.leave-print-vertical{display:flex;flex-direction:column;align-items:center;gap:3px;white-space:nowrap;font-size:11px;font-weight:bold}.leave-print-vertical strong{font-size:11px;margin-top:3px}.sign{margin-top:18px}@media print{.toolbar{display:none}thead{display:table-header-group}tr{break-inside:avoid}thead{display:table-header-group}thead tr{break-inside:avoid}}.grot-pdf-sheet{font:10px "Times New Roman",serif}</style></head><body><div class="toolbar"><button type="button" onclick="window.print()">Печать</button><button type="button" id="save-pdf" onclick="saveVacationPdf()">Сохранить PDF</button><button type="button" onclick="window.close()">Закрыть</button></div><div id="pdf-content"><table><colgroup><col style="width:3%"><col style="width:25%"><col style="width:5.5%"><col style="width:5.5%"><col style="width:5.5%"><col style="width:5.5%"><col style="width:5.5%"><col style="width:5.5%"><col style="width:5.5%"><col style="width:5.5%"><col style="width:5.5%"><col style="width:5.5%"><col style="width:5.5%"><col style="width:5.5%"><col style="width:6%"></colgroup><thead><tr><th colspan="15" class="document-title">Г Р А Ф И К &nbsp; О Т П У С К О В &nbsp; Н А &nbsp; '+String(year).split('').join(' ')+' &nbsp; Г О Д</th></tr><tr><th colspan="15" class="document-subtitle">'+esc(readOrganization().shortName||readOrganization().fullName)+' · '+esc(year===2026?'Архивный график':chart.name)+'</th></tr><tr><th>№</th><th>Ф. И. О. / должность / отдел</th>'+header+'<th>Всего<br>дней</th></tr></thead><tbody>'+body+'</tbody></table><p class="sign">Составил: __________________________ &nbsp;&nbsp; Дата: __________________</p></div></body></html>';
 const w=window.open('','_blank');if(!w){alert('Разрешите всплывающие окна для печати.');return}w.document.write(html);w.document.close();w.focus();
 const wordButton=w.document.createElement('button');
 wordButton.type='button';
 wordButton.textContent='Сохранить Word';
 wordButton.title='Редактируемый документ Word (.doc)';
 const printTools=w.document.querySelector('.toolbar');
 if(printTools){printTools.insertBefore(wordButton,printTools.lastElementChild);}
 wordButton.onclick=()=>{
   const docBody=w.document.querySelector('#pdf-content');
   if(!docBody){alert('Нет данных для экспорта в Word.');return;}
   const wordStyle='@page Section1{size:841.9pt 595.3pt;mso-page-orientation:landscape;margin:28pt 28pt 28pt 28pt}div.Section1{page:Section1}body{font:9pt "Times New Roman",serif;color:#111}table{border-collapse:collapse;width:100%;table-layout:fixed}td,th{border:1px solid #333;padding:3pt 2pt;vertical-align:middle}th{text-align:center;background:#eee}.document-title{text-align:center;font-weight:bold;font-size:17pt;letter-spacing:2pt;border:0;background:white}.document-subtitle{text-align:center;font-size:10pt;font-weight:normal;border:0;background:white}.num,.leave-print-total{text-align:center}.person b{font-size:10pt}small{display:block;font-size:8pt}.leave-print-dates,.leave-print-days,.leave-print-vertical{text-align:center;font-weight:bold;font-size:9pt}.leave-print-days{margin-top:5pt}.leave-print-vertical div{display:block}.leave-print-layer:not(.leave-print-last) td:not([rowspan]){border-bottom:0}.leave-print-layer:not(.leave-print-first) td{border-top:0}.sign{margin-top:16pt}';
   const wordHtml='<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" lang="ru"><head><meta charset="utf-8"><title>График отпусков '+year+'</title><style>'+wordStyle+'</style><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]--></head><body><div class="Section1">'+docBody.innerHTML+'</div></body></html>';
   const blob=new Blob(['\\ufeff',wordHtml],{type:'application/msword;charset=utf-8'});
   const url=URL.createObjectURL(blob);
   const link=w.document.createElement('a');
   link.href=url;
   link.download='ГРОТ_График_отпусков_'+year+'.doc';
   w.document.body.appendChild(link);
   link.click();
   link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),30000);
 };
}
function personnelPrint(){
 const esc=escapeHtml;
 const staff=drivers.filter(d=>periodsFor(d.id).length>0).sort((a,b)=>{
  const ac=printStaffDepartmentCode(a),bc=printStaffDepartmentCode(b);
  return (!ac!==!bc?(ac?-1:1):ac.localeCompare(bc,'ru',{numeric:true}))||shortStaffName(a).localeCompare(shortStaffName(b),'ru');
 });
 const body=staff.map(d=>{
  const periods=[...periodsFor(d.id)].sort((a,b)=>a.start.localeCompare(b.start));
  const span=periods.length,total=periods.reduce((sum,p)=>sum+leaveDays(p.start,p.end),0);
  const fullName=[d.lastName,d.firstName,d.middleName].filter(Boolean).join(' ')||d.name||'';
  const fixed=['<td rowspan="'+span+'">'+esc(printStaffDepartment(d))+'</td>',
   '<td rowspan="'+span+'">'+esc(fullName)+'</td>',
   '<td rowspan="'+span+'">'+esc(d.position||'Водитель автомобиля')+'</td>'].join('');
  return '<tbody class="staff-periods">'+periods.map((p,i)=>
   '<tr>'+(i===0?fixed:'')+
   '<td class="center">'+(i+1)+'</td><td class="center">'+leaveDays(p.start,p.end)+'</td>'+
   '<td class="center">'+esc(displayDate(p.start))+'</td><td class="center">'+esc(displayDate(p.end))+'</td>'+
   (i===0?'<td rowspan="'+span+'" class="center total-days">'+total+'</td>':'')+'</tr>'
  ).join('')+'</tbody>';
 }).join('');
 const html='<html lang="ru"><head><meta charset="UTF-8"><title>График отпусков 2027 — отдел кадров</title><style>@page{size:A4 landscape;margin:12mm}body{font:11px Arial,sans-serif;color:#111}h2{text-align:center}table{border-collapse:collapse;width:100%;table-layout:fixed}th,td{border:1px solid #555;padding:5px 4px;vertical-align:middle;overflow-wrap:anywhere}th{background:#eee;text-align:center}.center{text-align:center}.total-days{font-weight:bold}.staff-periods tr:first-child td{border-top:1.5px solid #222}.staff-periods{break-inside:avoid;page-break-inside:avoid}thead{display:table-header-group}.sign{margin-top:24px}.print-toolbar{display:flex;justify-content:flex-end;gap:10px;margin:0 0 16px}.print-toolbar button{padding:10px 16px;border:1px solid #94a3b8;border-radius:6px;background:#f1f5f9;font:inherit;cursor:pointer}@media print{.print-toolbar{display:none!important}thead{display:table-header-group}.staff-periods{break-inside:avoid;page-break-inside:avoid}tr{break-inside:avoid}}</style></head><body><div class="print-toolbar"><button type="button" onclick="window.print()">Печать / PDF</button><button type="button" onclick="window.close()">Закрыть</button></div><h2>Проект графика отпусков на 2027 год</h2><p>КГБУЗ «Владивостокская поликлиника № 9» · Подготовлено: '+new Date().toLocaleDateString('ru-RU')+'</p><table><thead><tr><th>Отдел</th><th>ФИО</th><th>Должность</th><th>Часть</th><th>Дней</th><th>Начало</th><th>Окончание</th><th>Всего<br>дней</th></tr></thead>'+body+'</table><p class="sign">Составил: _____________________ &nbsp;&nbsp; Дата: ______________</p><p>Документ для согласования. Не является утверждённым графиком отпусков без оформления работодателем.</p></body></html>';
 const w=window.open('','_blank');if(!w){alert('Разрешите всплывающие окна для печати.');return}w.document.write(html);w.document.close();w.focus();
}
function showDriverHistory(name){
 const surname=String(name||'').trim().split(/\s+/)[0].toLocaleLowerCase('ru');
 const matches=drivers.filter(d=>staffParts(d).last.toLocaleLowerCase('ru')===surname);
 const entries=loadHistory().filter(p=>String(p.driver||'').trim().split(/\s+/)[0].toLocaleLowerCase('ru')===surname);
 const current=matches.flatMap(d=>periodsFor(Number(d.id)).map(p=>({...p,year:2027})));
 const all=[...entries.map(p=>({...p,year:Number(p.year)||2026})),...current].filter(p=>p.start&&p.end);
 const years=[...new Set(all.map(p=>Number(p.year)))].sort((a,b)=>b-a);
 const headers=months.map(m=>'<th>'+escapeHtml(m.slice(0,3))+'</th>').join('');
 const rows=years.length?years.map(y=>{
   const dates=new Set();
   all.filter(p=>Number(p.year)===y).forEach(p=>{for(let d=p.start,n=0;d<=p.end&&n++<366;d=shift(d,1)){if(Number(d.slice(0,4))===y)dates.add(d)}});
   const counts=months.map((_,m)=>[...dates].filter(d=>Number(d.slice(5,7))===m+1).length);
   return '<tr><th>'+y+'</th>'+counts.map(n=>'<td class="'+(n?'has-vacation':'')+'">'+(n||'')+'</td>').join('')+'<td class="annual-total">'+dates.size+'</td></tr>';
 }).join(''):'<tr><td colspan="14">Записей об отпусках пока нет</td></tr>';
 let dialog=document.querySelector('#driver-history-dialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='driver-history-dialog';document.body.appendChild(dialog)}
 dialog.innerHTML='<h2>История отпусков: '+escapeHtml(name)+'</h2><p>Количество календарных дней отпуска по месяцам · только просмотр</p><div class="scroll"><table class="annual-table history-summary"><thead><tr><th>Год</th>'+headers+'<th>Всего</th></tr></thead><tbody>'+rows+'</tbody></table></div><div class="actions"><button type="button" id="driver-history-close">Закрыть</button></div>';
 dialog.querySelector('#driver-history-close').onclick=()=>dialog.close();dialog.showModal();
}
function showAboutGrot(){
 let dlg=document.getElementById('grot-about-dialog');if(!dlg){dlg=document.createElement('dialog');dlg.id='grot-about-dialog';document.body.appendChild(dlg)}
 dlg.innerHTML='<h2>О программе ГРОТ</h2><p><strong>ГРОТ — График отпусков</strong></p><p>Планирование и анализ ежегодных отпусков водителей.</p><p>Автор идеи и разработка: В. Л. Бахметьев<br>При содействии OpenAI</p><p>Год создания: 2026<br>Версия: '+APP_VERSION+'</p><div class="actions"><button type="button" id="grot-about-close">Закрыть</button></div>';
 dlg.querySelector('#grot-about-close').onclick=()=>dlg.close();dlg.showModal();
}
function refreshHeaderOrganization(){const org=app.querySelector('.grot-header-org');if(org){const data=readOrganization();org.textContent=data.shortName||data.fullName||''}}
function preserveYearHeader(previousHeader){
 if(!previousHeader)return;
 const replacement=app.querySelector('.grot-header');
 if(!replacement)return;
 replacement.replaceWith(previousHeader);
 const picker=previousHeader.querySelector('#grot-year');
 if(picker)picker.value=String(displayYear);
 refreshHeaderOrganization();
}
function renderHistory2026(){
 const previousHeader=app.querySelector('.grot-header');
 const entries=loadHistory().filter(p=>Number(p.year)===2026);
 const names=[...new Set(entries.map(p=>p.driver))];
 const groups={'Бахметьев':'8','Винник':'8','Данилюк':'9.1','Дунаев':'9.1','Илюхин':'9','Каминик':'11','Карнацкий':'8','Киселев':'1','Кулеш':'11','Ломов':'9','Мальцев':'9.1','Шпаков':'1'};
 names.sort((a,b)=>String(groups[a]||'').localeCompare(String(groups[b]||''),'ru',{numeric:true})||a.localeCompare(b,'ru'));
 const dateAt=(m,d)=>'2026-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
 const days=new Map(names.map(n=>[n,new Set()]));
 for(const p of entries){for(let d=p.start,n=0;d<=p.end&&n++<366;d=shift(d,1))days.get(p.driver)?.add(d)}
 const columns=months.flatMap((_,m)=>expandedMonths.has(m)?Array.from({length:new Date(2026,m+1,0).getDate()},(_,i)=>({m,d:i+1})):[{m,d:0}]);
 const cells=columns.map(c=>'<th><button type="button" data-history-month="'+c.m+'">'+(c.d||months[c.m].slice(0,3))+'</button></th>').join('');
 const rows=names.map(n=>'<tr><th class="fixed name"><button type="button" class="driver" data-history-driver="'+escapeHtml(n)+'">'+escapeHtml(n)+'</button></th><td class="fixed group">'+(groups[n]||'—')+'</td>'+columns.map(c=>{const set=days.get(n);const count=c.d?Number(set.has(dateAt(c.m,c.d))):[...set].filter(x=>Number(x.slice(5,7))===c.m+1).length;return '<td class="'+(c.d?'day ':'month-cell ')+(count?(c.d?'vacation':'has-vacation'):'')+'">'+(c.d?(count?'●':''):(count||''))+'</td>'}).join('')+'<td class="annual-total">'+(days.get(n).size||'')+'</td></tr>').join('');
 const totals=columns.map(c=>{const n=names.filter(n=>c.d?days.get(n).has(dateAt(c.m,c.d)):[...days.get(n)].some(x=>Number(x.slice(5,7))===c.m+1)).length;return '<td>'+(n||'')+'</td>';}).join('');
 app.innerHTML='<header class="grot-header"><img class="grot-header-logo" src="'+grotLogo+'" alt="ГРОТ"><div class="grot-header-title"><div class="grot-header-name">ГРАФИК ОТПУСКОВ</div><div class="grot-header-org">'+structureEscape(readOrganization().shortName||readOrganization().fullName)+'</div></div><div class="grot-header-year"><select id="grot-year" aria-label="Год графика"><option value="2026" selected>2026</option><option value="2027">2027</option></select></div></header><main><nav class="toolbar grot-toolbar" aria-label="Главное меню"><details class="grot-menu"><summary>Документ</summary><div class="grot-menu-panel"><button type="button" data-archive-go="vacation-charts-open">Графики отпусков</button><button type="button" id="archive-collapse">Свернуть все месяцы</button><button type="button" id="archive-current">Перейти к графику 2027</button><button type="button" id="archive-metrics">Анализ отпускной нагрузки · КОН / КСН / ИПО</button></div></details><details class="grot-menu"><summary>Справочник</summary><div class="grot-menu-panel"><button type="button" data-archive-organization="1">Организация</button><button type="button" data-archive-go="staff-open">Сотрудники</button><button type="button" data-archive-go="structure-open">Структура предприятия</button><button type="button" data-archive-go="calendar-open">Производственный календарь</button></div></details><details class="grot-menu"><summary>Печать</summary><div class="grot-menu-panel"><button type="button" id="archive-print">Печать графика 2026</button></div></details><details class="grot-menu"><summary>Сервис</summary><div class="grot-menu-panel"><button type="button" data-archive-go="backup-settings-open">Настройки</button><button type="button" id="archive-refresh">Обновить</button><button type="button" data-archive-go="help-open">Справка · Правила отпусков</button><button type="button" data-archive-about="1">О программе</button><button type="button" data-archive-go="backup-export">Резервная копия</button><button type="button" data-archive-go="backup-restore">Восстановить</button></div></details></nav><p><strong>Архивный график 2026 года</strong> · только просмотр · '+entries.length+' периодов. <button id="history-metrics">КОН / КСН / ИПО</button></p><div class="scroll"><table class="annual-table"><thead><tr><th class="fixed name">Водитель</th><th class="fixed group">Группа</th>'+cells+'<th>Всего дней</th></tr></thead><tbody>'+rows+'</tbody><tfoot><tr><th class="fixed name">В отпуске</th><td class="fixed group"></td>'+totals+'<td>'+(names.length||'')+'</td></tr></tfoot></table></div><p>Нажмите на месяц, чтобы развернуть или свернуть дни.</p><footer class="grot-version-footer">ГРОТ · версия ${APP_VERSION}<div>Разработка: В. Л. Бахметьев · при содействии OpenAI</div></footer></main>';
 preserveYearHeader(previousHeader);
 document.querySelector('#grot-year').value='2026';
 document.querySelector('#grot-year').onchange=e=>{displayYear=Number(e.target.value);render()};

 document.querySelectorAll('[data-history-driver]').forEach(b=>b.onclick=()=>showDriverHistory(b.dataset.historyDriver));
 document.querySelector('#archive-metrics').onclick=()=>openSeasonality(2026);
 document.querySelectorAll('[data-archive-about]').forEach(b=>b.onclick=showAboutGrot);
 document.querySelectorAll('[data-archive-organization]').forEach(b=>b.onclick=openOrganizationCard);
 document.querySelector('#archive-collapse').onclick=()=>{expandedMonths.clear();render()};
 document.querySelector('#archive-current').onclick=()=>{displayYear=2027;render()};
 document.querySelector('#archive-refresh').onclick=()=>location.reload();
 document.querySelector('#archive-print').onclick=()=>printMonthlyVacationChart(2026);
 document.querySelectorAll('[data-archive-go]').forEach(b=>b.onclick=()=>{const target=b.dataset.archiveGo;displayYear=2027;render();document.getElementById(target)?.click()});
 document.querySelectorAll('[data-history-month]').forEach(b=>b.onclick=()=>{const m=Number(b.dataset.historyMonth);expandedMonths.has(m)?expandedMonths.delete(m):expandedMonths.add(m);render()});
}
function render() {
 const previousHeader=app.querySelector('.grot-header');
  if(displayYear===2026){renderHistory2026();return;}
  const sets = new Map(drivers.map(d => [d.id, daysFor(d.id)]));
  const dateOf=(m,d)=>'2027-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
  const monthDays=m=>new Date(2027,m+1,0).getDate();
  const monthlyCount=(set,m)=>{let n=0;for(let d=1;d<=monthDays(m);d++){const date=dateOf(m,d);if(set.has(date)&&dayType(date)!=='holiday')n++;}return n;};
  const columns=months.flatMap((_,m)=>expandedMonths.has(m)?Array.from({length:monthDays(m)},(_,i)=>({m,day:i+1})): [{m,day:0}]);
  const headings=columns.map(c=>'<th class="'+(c.day?'day-heading':'month-heading')+'"><button type="button" data-month="'+c.m+'" title="'+(expandedMonths.has(c.m)?'Свернуть ':'Развернуть ')+months[c.m]+'">'+(c.day||months[c.m].slice(0,3))+'</button></th>').join('');
  const chart=activeVacationChart();
  const visibleDrivers=drivers.filter(d=>(chart.allStaff||chart.staffIds.map(String).includes(String(d.id)))&&isEligibleForYear(d,2027)&&(selectedDriverIds===null||selectedDriverIds.has(String(d.id)))&&(selectedGroups===null||selectedGroups.has(String(d.group)))).sort(compareGroupAndName);
  const chartMembers=drivers.filter(d=>(chart.allStaff||(chart.staffIds||[]).map(String).includes(String(d.id)))&&isEligibleForYear(d,2027));
  const groupConflicts=new Map();
  for(let i=0;i<chartMembers.length;i++)for(let j=i+1;j<chartMembers.length;j++){
    const a=chartMembers[i],b=chartMembers[j];
    if(!String(a.group||'').trim()||String(a.group||'')!==String(b.group||'')||String(a.department||'')!==String(b.department||''))continue;
    for(const pa of periodsFor(Number(a.id)))for(const pb of periodsFor(Number(b.id))){
      const start=pa.start>pb.start?pa.start:pb.start,end=pa.end<pb.end?pa.end:pb.end;
      if(start>end)continue;
      for(const [d,other] of [[a,b],[b,a]]){
        const id=String(d.id);
        if(!groupConflicts.has(id))groupConflicts.set(id,[]);
        groupConflicts.get(id).push(shortStaffName(other)+': '+displayDate(start)+' – '+displayDate(end));
      }
    }
  }
  const groups=[...new Set(drivers.filter(d=>isEligibleForYear(d,2027)).map(d=>String(d.group)))].sort((a,b)=>a.localeCompare(b,'ru',{numeric:true}));
  const priorityData=priorityForChart();
  const priorityCurrent=priorityData&&JSON.stringify(priorityData.staffIds)===JSON.stringify(drivers.filter(d=>chart.allStaff||(chart.staffIds||[]).map(String).includes(String(d.id))).map(d=>String(d.id)).sort());
  const priorityEntries=new Map((priorityCurrent?priorityData.entries:[]).map(x=>[x.id,x]));
  const annualCount=id=>periodsFor(id).reduce((sum,p)=>sum+leaveDays(p.start,p.end),0);
  const rows=visibleDrivers.map(d=>'<tr><th class="fixed name '+(groupConflicts.has(String(d.id))?'group-conflict-name':'')+'"><button class="driver '+(annualCount(d.id)>availableLeaveDays(d)?'leave-overlimit':'')+'" title="'+(annualCount(d.id)>availableLeaveDays(d)?'Превышение на '+(annualCount(d.id)-availableLeaveDays(d))+' дн.':'Отпуска сотрудника')+'" data-driver="'+d.id+'">'+escapeHtml(shortStaffName(d))+'</button>'+(groupConflicts.has(String(d.id))?'<button type="button" class="group-conflict-indicator" data-conflict-id="'+d.id+'" title="Пересечение отпусков в группе" aria-label="Показать пересечения отпусков">!</button>':'')+'</th><td><button type="button" class="priority-detail" data-priority-id="'+d.id+'" '+(priorityEntries.has(String(d.id))?'':'disabled')+' title="Расшифровка приоритета">'+(priorityEntries.get(String(d.id))?.rank??'—')+'</button></td><td class="fixed group"><button type="button" data-edit-group="'+d.id+'" title="Изменить группу отпусков" style="width:100%;min-height:28px;border:1px dashed #a3a3a3;border-radius:4px;background:transparent;cursor:pointer;font:inherit;color:inherit">'+escapeHtml(d.group||'—')+'</button></td>'+columns.map(c=>{const set=sets.get(d.id);if(!c.day){const n=monthlyCount(set,c.m);return '<td class="month-cell '+(n?'has-vacation':'')+'" data-month="'+c.m+'">'+(n||'')+'</td>';}const date=dateOf(c.m,c.day),active=set.has(date),type=dayType(date);return '<td class="day '+(active?'vacation ':'')+(type==='weekend'?'weekend ':'')+(type==='holiday'?'holiday':'')+'" data-id="'+d.id+'" data-date="'+date+'">'+(active?'●':'')+'</td>';}).join('')+'<td class="annual-total">'+(annualCount(d.id)||'')+'</td><td class="leave-available" title="Всего доступно с учётом корректировок">'+availableLeaveDays(d)+'</td><td class="leave-remaining">'+(availableLeaveDays(d)-annualCount(d.id))+'</td></tr>').join('');
  const totals=columns.map(c=>{const n=c.day?visibleDrivers.filter(d=>sets.get(d.id).has(dateOf(c.m,c.day))).length:visibleDrivers.filter(d=>monthlyCount(sets.get(d.id),c.m)>0).length;return '<td>'+(n||'')+'</td>';}).join('');
  app.innerHTML = `
    <header class="grot-header"><img class="grot-header-logo" src="${grotLogo}" alt="ГРОТ"><div class="grot-header-title"><div class="grot-header-name">ГРАФИК ОТПУСКОВ</div><div class="grot-header-org">${escapeHtml(readOrganization().shortName||readOrganization().fullName)}</div></div><div class="grot-header-year"><select id="grot-year" aria-label="Год графика"><option value="2026">2026</option><option value="2027" selected>2027</option></select></div></header>
    <main>
      <nav class="toolbar grot-toolbar" aria-label="Главное меню">
        <details class="grot-menu">
          <summary>Документ</summary>
          <div class="grot-menu-panel">
            <button type="button" id="vacation-charts-open">Графики отпусков</button><button type="button" id="collapse-month">Свернуть все месяцы</button>
            <button type="button" id="seasonality-open">Анализ отпускной нагрузки · КОН / КСН / ИПО</button>
          </div>
        </details>
        <details class="grot-menu">
          <summary>Справочник</summary>
          <div class="grot-menu-panel">
            <button type="button" id="organization-open">Организация</button>
            <button type="button" id="staff-open">Сотрудники</button><button type="button" id="positions-open">Должности</button><button type="button" id="structure-open">Структура предприятия</button>
            <button type="button" id="calendar-open">Производственный календарь</button>
          </div>
        </details>
        <details class="grot-menu">
          <summary>Печать</summary>
          <div class="grot-menu-panel">
            <button type="button" id="monthly-print">График по месяцам (А4)</button><button type="button" id="overlap-print">Пересечения в группе</button><button type="button" id="personnel-print">График для кадров (PDF)</button>
            <button type="button" id="personnel-csv">Экспорт в Excel</button>
          </div>
        </details>
        <details class="grot-menu">
          <summary>Сервис</summary>
          <div class="grot-menu-panel">
            <button type="button" id="backup-settings-open">Настройки</button><button type="button" id="backup-export">Резервная копия</button>
            <button type="button" id="backup-restore">Восстановить</button>
            <button type="button" id="app-refresh">Обновить</button>
            <button type="button" id="help-open">Справка · Правила отпусков</button><button type="button" id="about-open">О программе</button>
          </div>
        </details>
        <input type="file" id="backup-file" accept=".json,application/json" hidden>
      </nav>
      <div class="chart-actionbar"><strong>График: ${escapeHtml(chart.name)}</strong><button type="button" id="chart-info-open" class="chart-info-button" title="Подсказки по графику" aria-label="Подсказки по графику">ⓘ</button><button type="button" id="service-messages-open" class="service-messages-button" title="Служебные сообщения" aria-label="Служебные сообщения">🔔${notice?'<span class="service-alert-dot" aria-hidden="true"></span>':''}</button><button type="button" id="priority-calculate">Рассчитать приоритет</button></div>
      <div class="scroll"><table class="annual-table"><thead><tr>
      <th class="fixed name"><span class="header-filter">${escapeHtml(activeVacationChart().name)} <button type="button" class="filter-trigger" data-filter-open="driver" aria-label="Фильтр водителей">▾</button></span></th>
      <th>Приоритет</th><th class="fixed group"><span class="header-filter">Группа <button type="button" class="filter-trigger" data-filter-open="group" aria-label="Фильтр групп">▾</button></span></th>${headings}<th class="annual-total-heading">Запланировано</th><th>Доступно</th><th>Остаток</th></tr></thead>
      <tbody>${rows}</tbody><tfoot><tr><th class="fixed name">В отпуске</th><td></td><td class="fixed group"></td>${totals}<td class="annual-total">${visibleDrivers.filter(d=>annualCount(d.id)>0).length||''}</td><td></td><td></td></tr></tfoot></table></div>
      <p class="table-help">Нажмите на название месяца, чтобы развернуть его дни; повторное нажатие свернёт только этот месяц. Можно открыть несколько месяцев одновременно. Нажмите на фамилию для просмотра отпусков.</p>
      
      <p class="muted storage-warning">Тестовая версия: данные хранятся только в этом браузере, не в облаке.</p>
    <footer class="grot-version-footer">ГРОТ · версия ${APP_VERSION}<div>Разработка: В. Л. Бахметьев · при содействии OpenAI</div></footer></main>
    <dialog id="service-messages-dialog" class="chart-info-dialog service-messages-dialog"><h2>Служебные сообщения</h2><p class="service-message-current" id="service-message-current">${notice?escapeHtml(notice):'Новых сообщений нет.'}</p><p><strong>Приоритет:</strong> ${escapeHtml(priorityCurrent?(priorityData.incomplete?'Предварительный расчёт: не у всех есть данные за 2026 год':'Рассчитан по данным 2026 года'):priorityData?'Состав изменён — пересчитайте приоритет':'Ещё не рассчитан')}</p><p><strong>Хранение:</strong> данные хранятся только в этом браузере, не в облаке. Создавайте резервные копии через «Сервис».</p><div class="actions"><button type="button" id="service-messages-close">Закрыть</button></div></dialog>
    <dialog id="chart-info-dialog" class="chart-info-dialog"><h2>Подсказки по графику</h2><p><strong>Месяцы:</strong> нажмите на название месяца, чтобы открыть дни. Повторное нажатие сворачивает этот месяц; можно открыть несколько месяцев.</p><p><strong>Сотрудник:</strong> нажмите на фамилию для просмотра и изменения отпусков.</p><p><strong>Группа:</strong> нажмите на номер группы для его изменения. Пересечения проверяются только у сотрудников одной непустой группы и одного подразделения. Если группа не указана, сотрудник может уходить в отпуск одновременно с любыми другими — конфликта по группе нет. Для всех номеров групп действуют одинаковые правила.</p><p><strong>Приоритет:</strong> рассчитывается на основе доступных данных за 2026 год.</p><p><strong>Хранение:</strong> данные сохраняются в этом браузере, а не в облаке. Делайте резервные копии через «Сервис».</p><div class="actions"><button type="button" id="chart-info-close">Закрыть</button></div></dialog>
    <dialog id="filter-dialog"><h2 id="filter-title">Фильтр</h2><div class="filter-actions"><button type="button" id="filter-all">Выбрать все</button><button type="button" id="filter-none">Снять все</button></div><div id="filter-options"></div><div class="actions"><button type="button" id="filter-cancel">Отмена</button><button type="button" id="filter-apply">Применить</button></div></dialog>
    <dialog id="structure-dialog" class="structure-dialog"><h2>Структура предприятия</h2><div class="staff-toolbar"><button type="button" id="structure-add">＋ Добавить</button><button type="button" id="structure-edit">✏️ Изменить</button><button type="button" id="structure-delete">Удалить</button><button type="button" id="structure-assign">Выбрать сотрудников</button><button type="button" id="structure-new-employee">＋ Новый сотрудник</button><button type="button" id="structure-close">× Закрыть</button></div><div id="structure-tree"></div><p id="structure-current" class="muted"></p></dialog><dialog id="structure-card-dialog" class="structure-dialog"><h2 id="structure-card-title">Структурное звено</h2><form id="structure-card-form"><div class="structure-fields"><label>Тип<select id="structure-card-type"></select></label><label>Наименование<input id="structure-card-name" required></label><label>Код<input id="structure-card-code"></label><label>Вышестоящее подразделение<input id="structure-card-parent" disabled></label><label>Должность руководителя<input id="structure-card-title-position"></label><label>Руководитель<select id="structure-card-leader"></select></label></div><div class="actions"><button type="button" id="structure-card-cancel">Закрыть</button><button type="submit" id="structure-card-save">Записать и закрыть</button></div></form></dialog>
<dialog id="structure-assign-dialog" class="structure-dialog"><h2 id="structure-assignment-title">Добавить сотрудников</h2><p class="muted">Отметьте сотрудников для выбранного звена. Снятие отметки открепит сотрудника от него. Отпуска сохраняются.</p><div id="structure-employees"></div><div class="actions"><button type="button" id="structure-assign-cancel">Отмена</button><button type="button" id="structure-assign-save">Сохранить</button></div></dialog>
<dialog id="vacation-charts-dialog"><h2>Графики отпусков · 2027</h2><table class="staff-table"><thead><tr><th>Название</th><th>Год</th><th>Сотрудников</th><th></th></tr></thead><tbody id="vacation-charts-list"></tbody></table><div class="actions"><button type="button" id="vacation-chart-add">＋ Добавить</button><button type="button" id="vacation-charts-close">Закрыть</button></div></dialog><dialog id="vacation-chart-members-dialog"><h2>Состав графика: <span id="vacation-chart-name"></span></h2><div id="vacation-chart-members" style="max-height:55vh;overflow:auto"></div><div class="actions"><button type="button" id="vacation-chart-save">Сохранить</button><button type="button" id="vacation-chart-cancel">Отмена</button></div></dialog><dialog id="positions-dialog"><h2>Справочник должностей</h2><div id="positions-list" style="max-height:50vh;overflow:auto"></div><div style="display:flex;gap:8px"><input id="positions-new" placeholder="Новая должность" maxlength="120"><button type="button" id="positions-add">Добавить</button></div><div class="actions"><button type="button" id="positions-close">Закрыть</button></div></dialog><dialog id="staff-dialog"><h2>Справочник сотрудников</h2>
      <div class="staff-toolbar"><button type="button" id="staff-add" title="Добавить сотрудника" aria-label="Добавить сотрудника">＋</button><button type="button" id="staff-view" title="Просмотр" aria-label="Просмотр" disabled>◎</button><button type="button" id="staff-edit" title="Изменить" aria-label="Изменить" disabled>✎</button><button type="button" id="staff-delete" title="Удалить" aria-label="Удалить" disabled>⌫</button><button type="button" id="staff-import-2026" title="Загрузить из 2026 года" aria-label="Загрузить из 2026 года">⇩</button><span class="staff-toolbar-hint" id="staff-selected-label">Выберите сотрудника</span><button type="button" id="staff-close" title="Закрыть" aria-label="Закрыть">×</button></div><div class="staff-search-row"><label for="staff-search">Поиск</label><input id="staff-search" type="search" placeholder="Фамилия, имя, должность, подразделение или группа" autocomplete="off"><button type="button" id="staff-search-clear" title="Очистить поиск" aria-label="Очистить поиск">×</button><span id="staff-search-count"></span></div><div id="staff-list"></div>
    </dialog>
    <dialog id="staff-import-dialog"><h2>Перенос сотрудников из 2026 года</h2><p>Из архива берутся только фамилии и известные группы. Проверьте полные ФИО, группы и нормы отпуска после переноса. Совпадающие фамилии не добавляются повторно.</p><div class="staff-table-scroll" id="staff-import-list"></div><p id="staff-import-status" role="status"></p><div class="actions"><button type="button" id="staff-import-confirm">Добавить выбранных</button><button type="button" id="staff-import-cancel">Отмена</button></div></dialog>
    <dialog id="backup-preview-dialog" class="structure-dialog"><h2>Резервное копирование</h2><div id="backup-preview-details" style="white-space:pre-line;line-height:1.8"></div><p class="muted">В копию также входят справочники, настройки и доступная история.</p><div class="actions"><button type="button" id="backup-preview-cancel">Отмена</button><button type="button" id="backup-preview-save">Сохранить копию</button></div></dialog>
    <dialog id="backup-result-dialog" class="structure-dialog"><h2 id="backup-result-title">Резервная копия</h2><div id="backup-result-details" style="white-space:pre-line;line-height:1.8"></div><div class="actions"><button type="button" id="backup-result-close">Закрыть</button></div></dialog>
    <dialog id="backup-settings-dialog" class="structure-dialog"><h2>Настройки · Резервные копии</h2><p id="backup-directory-status"></p><p class="muted">Выберите папку для сохранения и восстановления копий. Браузер может повторно запросить доступ к ней.</p><div class="actions"><button type="button" id="backup-directory-choose">Выбрать папку</button><button type="button" id="backup-settings-close">Закрыть</button></div></dialog><dialog id="staff-card"><h2 id="staff-card-title">Карточка сотрудника</h2><form id="staff-form">
        <input type="hidden" id="staff-id">
        <label>Фамилия <input id="staff-last" required maxlength="100"></label><label>Имя <input id="staff-first" required maxlength="100"></label><label>Отчество <input id="staff-middle" maxlength="100"></label>
        <label>Подразделение <input id="staff-department" maxlength="100"></label>
        <label>Должность <input id="staff-position" list="staff-position-options" maxlength="120" autocomplete="off"><datalist id="staff-position-options"></datalist></label><label>Код структурного звена <input id="staff-structure-code" readonly></label><label>Группа отпусков <input id="staff-group" maxlength="30"></label>
        <label>Дата приёма <input id="staff-hired" type="date"></label><label>Дата увольнения <input id="staff-dismissal" type="date"></label><label><input id="staff-dismissed" type="checkbox"> Уволен (если дата неизвестна)</label><section class="leave-breakdown" style="grid-column:1/-1;border-top:1px solid #cbd5e1;padding-top:8px"><strong>Ежегодный отпуск</strong><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:8px"><label>Основной отпуск, дней <input id="staff-leave-basic" type="number" min="0" max="120" value="28"></label><label>Дополнительный за территорию, дней <input id="staff-leave-territory" type="number" min="0" max="120" value="8"></label><label>Другие дополнительные отпуска, дней <input id="staff-leave-other" type="number" min="0" max="120" value="0"></label><label>Нераспределённая норма, дней <input id="staff-leave-legacy" type="number" min="0" max="120" value="0"></label></div><label>Итого ежегодный отпуск, дней <input id="staff-allowance" type="number" readonly value="36"></label><small>Для ранее введённых норм сохраняется прежнее число дней в поле «Нераспределённая норма». Распределите его по составляющим вручную.</small></section>
        <section id="staff-days-section" style="grid-column:1/-1;border-top:1px solid #cbd5e1;padding-top:8px"><strong>Учёт отпускных дней</strong><p id="staff-days-summary" style="margin:6px 0"></p><div id="staff-days-history" style="max-height:145px;overflow:auto"></div><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:7px"><select id="staff-days-type"><option value="balance">Остаток прошлых лет</option><option value="addition">Добавить дни</option><option value="reduction">Уменьшить дни</option><option value="compensation">Компенсация</option></select><input id="staff-days-year" type="text" placeholder="Рабочий год" style="width:135px" maxlength="30"><input id="staff-days-count" type="number" min="1" max="365" placeholder="Дней" style="width:85px"><input id="staff-days-reason" placeholder="Причина / основание" maxlength="250" style="flex:1;min-width:150px"><button type="button" id="staff-days-add">Записать</button></div><small>Изменения сохраняются вместе с карточкой сотрудника. Удаление записи требует подтверждения.</small></section><p id="staff-error" role="alert"></p>
        <div class="actions"><button type="submit">Сохранить</button><button type="button" id="staff-card-close">Закрыть</button></div>
      </form>
    </dialog>
    <dialog id="editor"><form id="vacation-form">
      <div class="editor-header"><h2 id="editor-title">Отпуска 2027</h2><button type="button" id="editor-close-x" class="dialog-close-x" aria-label="Закрыть календарь" title="Закрыть">×</button></div>
      <label class="editor-person-label">Водитель <select id="person">${drivers.map(d=>`<option value="${d.id}">${d.name} — группа ${d.group}</option>`).join('')}</select></label>
      <div class="editor-top"><p class="muted">Календарь 2027 года · выбор начала и окончания отпуска</p>
      <p id="range-hint">Выберите начало отпуска, затем окончание.</p></div>
      <div class="editor-calendar-scroll"><div id="range-calendar" class="range-calendar"></div></div>
      <div class="editor-bottom"><div id="range-selected"></div><div class="periods-toolbar"><div id="range-periods" class="period-scroll" tabindex="0"></div><div class="editor-mode-actions"><button type="button" id="mode-add">Добавить период</button><button type="button" id="mode-edit">Изменить</button><button type="button" id="mode-delete">Удалить</button></div></div>
      <input id="start" type="hidden"><input id="end" type="hidden">
      <div id="day-count" class="day-count" aria-live="polite"></div><p id="editor-split-warning" class="rule-warning" role="status"></p><p class="muted">Добавление создаёт новый период. Изменение заменяет выбранный период.</p>
      <p id="form-error" role="alert"></p>
      <div class="actions"><button type="button" id="editor-history">История отпусков</button><button type="button" id="cancel">Закрыть</button><button type="submit">Сохранить</button></div></div>
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
    <dialog id="driver-card"><h2 id="driver-title">Отпуска водителя</h2><div id="period-list"></div><div id="period-total" class="day-count"></div><div id="split-rule"></div><div class="actions"><button type="button" id="driver-history">История по годам</button><button type="button" id="driver-close">Закрыть</button><button type="button" id="driver-add">Добавить период</button></div></dialog>`;
  preserveYearHeader(previousHeader);
  document.querySelector('#personnel-csv').onclick=personnelCsv;
  document.querySelector('#monthly-print').onclick=()=>printMonthlyVacationChart(2027);
  document.querySelector('#overlap-print').onclick=printGroupOverlaps;
  document.querySelector('#personnel-print').onclick=personnelPrint;
  document.querySelector('#backup-settings-open').onclick=backupSettingsOpen;
  document.querySelector('#backup-settings-close').onclick=()=>document.querySelector('#backup-settings-dialog').close();
  document.querySelector('#backup-directory-choose').onclick=backupDirectoryChoose;
  backupDirectoryLoad().then(backupDirectoryStatus);
  const backupPreviewDialog=document.querySelector('#backup-preview-dialog');
  const backupResultDialog=document.querySelector('#backup-result-dialog');
  document.querySelector('#backup-preview-cancel').onclick=()=>backupPreviewDialog.close();
  document.querySelector('#backup-result-close').onclick=()=>backupResultDialog.close();
  function showBackupResult(title,details){
    document.querySelector('#backup-result-title').textContent=title;
    document.querySelector('#backup-result-details').textContent=details;
    backupResultDialog.showModal();
  }
  document.querySelector('#backup-export').onclick=()=>{
    const org=readOrganization();
    const unitCount=structureNodes.filter(node=>node.type==='department').length;
    document.querySelector('#backup-preview-details').textContent=
      'Организация: '+(org.shortName||org.fullName||'Не указана')+'\n'+
      'Год: 2027\n'+
      'Сотрудников: '+drivers.length+'\n'+
      'Графиков: '+vacationCharts.length+'\n'+
      'Периодов отпусков: '+vacations.length+'\n'+
      'Отделов: '+unitCount;
    backupPreviewDialog.showModal();
  };
  document.querySelector('#backup-preview-save').onclick=async()=>{
    backupPreviewDialog.close();
    const payload={format:'grot-backup',version:2,year:2027,createdAt:new Date().toISOString(),staff:drivers,vacations,calendarOverrides,organization:readOrganization(),structure:structureNodes,charts:vacationCharts,activeChartId:activeVacationChartId,positions:JSON.parse(localStorage.getItem(positionsKey)||'[]'),priorities:readPriorities(),seasonalityHistory:JSON.parse(localStorage.getItem('grot-seasonality-history-v1')||'[]')};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const now=new Date();const stamp=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-')+'-'+[now.getHours(),now.getMinutes(),now.getSeconds()].map(x=>String(x).padStart(2,'0')).join('-');
    const filename='grot-'+stamp+'.json';
    let notice='';
    if(backupDirectory&&await backupDirectoryPermission('readwrite')){
      try{
        const fileHandle=await backupDirectory.getFileHandle(filename,{create:true});
        const writer=await fileHandle.createWritable();await writer.write(blob);await writer.close();
        notice='Резервная копия сохранена: '+filename+' ('+backupDirectory.name+').';
        showBackupResult('Резервная копия сохранена','Имя файла: '+filename+'\nПапка: '+backupDirectory.name+'\nФайл записан успешно.');
      }catch(err){showBackupResult('Ошибка сохранения','Имя файла: '+filename+'\nНе удалось записать файл: '+err.message);return}
    }else{
      try{
        const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
        notice='Резервная копия передана браузеру для загрузки: '+filename+'.';
        showBackupResult('Загрузка резервной копии','Имя файла: '+filename+'\nМесто: загрузки браузера (точный путь недоступен).\nПроверьте, что файл появился в загрузках.');
      }catch(err){showBackupResult('Ошибка загрузки','Не удалось начать загрузку: '+err.message);return}
    }
    const msg=document.querySelector('#service-message-current');if(msg)msg.textContent=notice;
    const button=document.querySelector('#service-messages-open');if(button&&!button.querySelector('.service-alert-dot'))button.insertAdjacentHTML('beforeend','<span class="service-alert-dot" aria-hidden="true"></span>');
  };
  document.querySelector('#backup-restore').onclick=async()=>{
    if(backupDirectory&&window.showOpenFilePicker&&await backupDirectoryPermission('read')){
      try{const handles=await window.showOpenFilePicker({startIn:backupDirectory,multiple:false,types:[{description:'Резервные копии ГРОТ',accept:{'application/json':['.json']}}]});if(handles.length){const file=await handles[0].getFile();await restoreBackupFile(file)}return}
      catch(err){if(err.name==='AbortError')return;console.warn(err)}
    }
    document.querySelector('#backup-file').click();
  };
  document.querySelector('#backup-file').onchange=async e=>{const file=e.target.files?.[0];e.target.value='';if(file)await restoreBackupFile(file)};
  async function restoreBackupFile(file){
    try{
      if(file.size>5_000_000)throw Error('Файл слишком большой (более 5 МБ).');
      const data=JSON.parse(await file.text());
      if(!data||data.format!=='grot-backup'||![1,2].includes(data.version)||data.year!==2027)throw Error('Это не резервная копия ГРОТ за 2027 год.');
      if(!Array.isArray(data.staff)||!data.staff.length||!Array.isArray(data.vacations)||!data.calendarOverrides||typeof data.calendarOverrides!=='object'||Array.isArray(data.calendarOverrides))throw Error('В файле отсутствуют обязательные данные.');
      const isObject=x=>x&&typeof x==='object'&&!Array.isArray(x);
      if(data.version===2){
        if(!isObject(data.organization)||typeof data.organization.shortName!=='string'||!data.organization.shortName.trim())throw Error('В копии отсутствует организация.');
        if(!Array.isArray(data.structure)||!Array.isArray(data.charts)||!data.charts.length||!Array.isArray(data.positions)||!isObject(data.priorities)||!Array.isArray(data.seasonalityHistory))throw Error('В копии отсутствуют настройки графиков или структуры.');
        if(data.charts.some(c=>!isObject(c)||typeof c.id!=='string'||!c.id||typeof c.name!=='string'||!Array.isArray(c.staffIds)))throw Error('Ошибка в справочнике графиков.');
        if(data.structure.some(n=>!isObject(n)||typeof n.id!=='string'||typeof n.type!=='string'))throw Error('Ошибка в структуре организации.');
      }
      const ids=new Set();
      // Пустая группа и 0 дней разрешены карточкой сотрудника.
      // Все дополнительные поля резервной копии сохраняются.
      const restoredStaff=data.staff.map((d,index)=>{
        if(!d||typeof d!=='object'||Array.isArray(d))throw Error('Ошибка в справочнике сотрудников: запись № '+(index+1)+'.');
        const id=Number(d.id);
        const name=typeof d.name==='string'&&d.name.trim()?d.name.trim():
          [d.lastName,d.firstName,d.middleName].filter(x=>typeof x==='string'&&x.trim()).join(' ').trim();
        const allowance=d.allowance===undefined||d.allowance===null||d.allowance===''?36:Number(d.allowance);
        if(!Number.isSafeInteger(id)||id<1||!name||!Number.isInteger(allowance)||allowance<0||allowance>120||ids.has(id)){
          throw Error('Ошибка в справочнике сотрудников: запись № '+(index+1)+' (ID, ФИО, дни отпуска или повтор ID).');
        }
        ids.add(id);
        return {...d,id,name,group:String(d.group??''),allowance};
      });
      const validDate=x=>typeof x==='string'&&/^2027-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+'T12:00:00Z'))&&new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;
      for(const p of data.vacations){
        if(!p||!ids.has(Number(p.driverId))||!validDate(p.start)||!validDate(p.end)||p.end<p.start)throw Error('Ошибка в периодах отпусков.');
      }
      for(const [date,type] of Object.entries(data.calendarOverrides)){
        if(!validDate(date)||!['holiday','weekend','workday'].includes(type))throw Error('Ошибка в производственном календаре.');
      }
      const newOrg=data.version===2?data.organization.shortName:'(не включена в старую копию)';
      const oldOrg=readOrganization().shortName;
      const warning=data.version===1?'\n\nВНИМАНИЕ: старая копия не содержит графики и организацию. Они останутся прежними на этом устройстве.':'\n\nОрганизация в копии: '+newOrg+'\nТекущая организация: '+oldOrg+'\nСтруктура, графики и реквизиты будут ЗАМЕНЕНЫ.';
      if(!confirm('Восстановить копию от '+(data.createdAt?new Date(data.createdAt).toLocaleString('ru-RU'):'неизвестной даты')+'?\nСотрудников: '+restoredStaff.length+'\nПериодов отпусков: '+data.vacations.length+'\nГрафиков: '+(data.version===2?data.charts.length:'нет в копии')+warning+'\n\nПеред восстановлением сохраните резервную копию текущего ПК. Продолжить?'))return;
      const writes=[
        [staffKey,JSON.stringify(restoredStaff)],
        [key,JSON.stringify(data.vacations)],
        [calendarKey,JSON.stringify(data.calendarOverrides)]
      ];
      if(data.version===2){
        writes.push(
          [orgStorageKey,JSON.stringify(data.organization)],
          [structureKey,JSON.stringify(data.structure)],
          [vacationChartsKey,JSON.stringify(data.charts)],
          ['grotActiveVacationChart',data.charts.some(c=>c.id===data.activeChartId)?data.activeChartId:data.charts[0].id],
          [positionsKey,JSON.stringify(data.positions)],
          [priorityKey,JSON.stringify(data.priorities)],
          ['grot-seasonality-history-v1',JSON.stringify(data.seasonalityHistory)]
        );
      }
      const previous=writes.map(([k])=>[k,localStorage.getItem(k)]);
      try{for(const [k,v] of writes)localStorage.setItem(k,v);}
      catch(err){
        for(const [k,v] of previous){try{if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v);}catch{}}
        throw Error('Не удалось сохранить данные. Предыдущие записи восстановлены, насколько позволило хранилище.');
      }
      drivers=restoredStaff;vacations=data.vacations;calendarOverrides=data.calendarOverrides;
      if(data.version===2){
        structureNodes=data.structure;
        vacationCharts=data.charts;
        activeVacationChartId=localStorage.getItem('grotActiveVacationChart');
        refreshHeaderOrganization();
      }
      selectedDriverIds=null;selectedGroups=null;
      notice='Резервная копия восстановлена: '+drivers.length+' сотрудников, '+vacations.length+' периодов'+(data.version===2?', '+vacationCharts.length+' графиков.':'. Старая копия: графики не переносились.');
      render();
    }catch(err){alert('Восстановление отменено: '+err.message);}
  };
  let pendingDayOperations=[];
  function redrawDayOperations(){
    const base=Number(document.querySelector('#staff-allowance').value)||0;
    const delta=pendingDayOperations.reduce((sum,x)=>sum+x.days,0);
    document.querySelector('#staff-days-summary').textContent='Ежегодный отпуск: '+base+' дн. · Корректировки: '+(delta>=0?'+':'')+delta+' дн. · Доступно: '+(base+delta)+' дн.';
    const container=document.querySelector('#staff-days-history');
    container.innerHTML=pendingDayOperations.map((x,i)=>'<div style="display:flex;gap:8px;align-items:center;border-bottom:1px solid #ddd;padding:3px 0"><span style="flex:1">'+escapeHtml(x.date)+' · '+escapeHtml(x.year)+' · '+escapeHtml(x.type)+' · '+(x.days>0?'+':'')+x.days+' дн. · '+escapeHtml(x.reason)+'</span><button type="button" data-day-remove="'+i+'">×</button></div>').join('')||'<span class="muted">Записей нет</span>';
    container.querySelectorAll('[data-day-remove]').forEach(b=>b.onclick=()=>{if(confirm('Удалить эту запись?')){pendingDayOperations.splice(Number(b.dataset.dayRemove),1);redrawDayOperations()}});
  }
  const leaveFieldIds=['staff-leave-basic','staff-leave-territory','staff-leave-other','staff-leave-legacy'];
  function recalculateAnnualLeave(){
    const total=leaveFieldIds.reduce((sum,id)=>sum+(Number(document.querySelector('#'+id).value)||0),0);
    document.querySelector('#staff-allowance').value=total;
    redrawDayOperations();
  }
  leaveFieldIds.forEach(id=>document.querySelector('#'+id).addEventListener('input',recalculateAnnualLeave));
  document.querySelector('#staff-days-add').onclick=()=>{
    const type=document.querySelector('#staff-days-type').value,year=document.querySelector('#staff-days-year').value.trim(),count=Number(document.querySelector('#staff-days-count').value),reason=document.querySelector('#staff-days-reason').value.trim();
    if(!year||!Number.isInteger(count)||count<1||count>365||!reason){alert('Укажите рабочий год, количество дней и основание.');return}
    const days=['reduction','compensation'].includes(type)?-count:count;
    const allowance=Number(document.querySelector('#staff-allowance').value)||0;
    if(allowance+pendingDayOperations.reduce((a,x)=>a+x.days,0)+days<0){alert('Нельзя получить отрицательный остаток дней.');return}
    pendingDayOperations.push({date:new Date().toISOString().slice(0,10),year,type,days,reason});
    document.querySelector('#staff-days-count').value='';document.querySelector('#staff-days-reason').value='';redrawDayOperations();
  };
  document.querySelector('#staff-allowance').addEventListener('input',redrawDayOperations);
  function openStaffCard(d,structureId=null){
    const form=document.querySelector('#staff-form');form.reset();updatePositionSuggestions();pendingDayOperations=(d?.dayOperations||[]).map(x=>({...x}));
    form.dataset.structureId=structureId||'';
    form.dataset.fromStructure=structureId?'1':'0';
    document.querySelector('#staff-id').value=d?.id||'';
    document.querySelector('#staff-card-title').textContent=d?'Карточка сотрудника':'Новый сотрудник';
    if(d){const p=staffParts(d);document.querySelector('#staff-last').value=p.last;document.querySelector('#staff-first').value=p.first;document.querySelector('#staff-middle').value=p.middle;document.querySelector('#staff-department').value=d.department||'';document.querySelector('#staff-group').value=d.group;document.querySelector('#staff-position').value=d.position||'';document.querySelector('#staff-leave-basic').value=d.leaveBreakdown?.basic??0;document.querySelector('#staff-leave-territory').value=d.leaveBreakdown?.territory??0;document.querySelector('#staff-leave-other').value=d.leaveBreakdown?.other??0;document.querySelector('#staff-leave-legacy').value=d.leaveBreakdown?.legacy??d.allowance;document.querySelector('#staff-allowance').value=d.allowance;document.querySelector('#staff-hired').value=d.hireDate||'';document.querySelector('#staff-dismissal').value=d.dismissalDate||'';document.querySelector('#staff-dismissed').checked=Boolean(d.dismissed);}
    if(!d){document.querySelector('#staff-leave-basic').value=28;document.querySelector('#staff-leave-territory').value=8;document.querySelector('#staff-leave-other').value=0;document.querySelector('#staff-leave-legacy').value=0;}
    recalculateAnnualLeave();
    const effectiveStructureId=structureId||d?.structureId;document.querySelector('#staff-structure-code').value=structureNodes.find(n=>n.id===effectiveStructureId)?.code||'';
    if(structureId){const hierarchy=structureAncestors(structureId);const division=hierarchy.find(x=>x.type==='division');document.querySelector('#staff-department').value=division?.name||'';}
    redrawDayOperations();
    document.querySelector('#staff-dialog').close();document.querySelector('#staff-card').showModal();
  }
  let selectedStaffId=null;
  function selectedStaff(){return drivers.find(d=>d.id===selectedStaffId)}
  function updateStaffSelection(){const d=selectedStaff();for(const id of ["staff-view","staff-edit","staff-delete"])document.querySelector("#"+id).disabled=!d;document.querySelector("#staff-selected-label").textContent=d?shortStaffName(d):"Выберите сотрудника";document.querySelectorAll("#staff-list tr[data-staff-row]").forEach(row=>row.classList.toggle("staff-selected",Number(row.dataset.staffRow)===selectedStaffId));}
  document.querySelector('#staff-search').addEventListener('input',drawStaff);
  document.querySelector('#staff-search-clear').onclick=()=>{document.querySelector('#staff-search').value='';drawStaff();document.querySelector('#staff-search').focus()};
  function drawStaff(){
    const query=document.querySelector('#staff-search').value.trim().toLocaleLowerCase('ru');
    const sorted=[...drivers].filter(d=>!query||[shortStaffName(d),d.lastName,d.firstName,d.middleName,d.position,d.department,d.group].some(v=>String(v||'').toLocaleLowerCase('ru').includes(query))).sort((a,b)=>Number(Boolean(a.dismissed||a.dismissalDate))-Number(Boolean(b.dismissed||b.dismissalDate))||compareGroupAndName(a,b));
    document.querySelector('#staff-search-count').textContent=sorted.length+' из '+drivers.length;
    document.querySelector('#staff-list').innerHTML='<div class="staff-table-scroll"><table class="staff-table"><thead><tr><th>№</th><th>Фамилия И.О.</th><th>Подразделение</th><th>Группа отпусков</th><th>Дней отпуска</th></tr></thead><tbody>'+sorted.map((d,i)=>'<tr data-staff-row="'+d.id+'"><td>'+(i+1)+'</td><td><button type="button" class="staff-name-link" data-staff="'+d.id+'">'+escapeHtml(shortStaffName(d))+'</button></td><td>'+escapeHtml(d.department||'—')+'</td><td>'+escapeHtml(d.group)+'</td><td>'+d.allowance+'</td></tr>').join('')+'</tbody></table></div>';
    document.querySelectorAll('[data-staff]').forEach(btn=>btn.onclick=()=>{selectedStaffId=Number(btn.dataset.staff);updateStaffSelection();});
    document.querySelectorAll('[data-staff-row]').forEach(row=>{
      row.onclick=()=>{selectedStaffId=Number(row.dataset.staffRow);updateStaffSelection();};
      row.ondblclick=()=>{selectedStaffId=Number(row.dataset.staffRow);updateStaffSelection();const d=selectedStaff();if(d)openStaffCard(d);};
    });
    updateStaffSelection();
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
    drawStaff();render();
  });
  document.querySelector('#organization-open').onclick=openOrganizationCard;
  document.querySelector('#structure-open').onclick=structureOpen;
  document.querySelector('#structure-close').onclick=()=>document.querySelector('#structure-dialog').close();
  document.querySelector('#structure-add').onclick=structureAdd;
  document.querySelector('#structure-edit').onclick=structureEdit;
  document.querySelector('#structure-delete').onclick=structureRemove;
  document.querySelector('#structure-assign').onclick=structureAssignOpen;
  document.querySelector('#structure-new-employee').onclick=()=>{const n=structureSelected();if(!n||n.type==='organization'){alert('Выберите подразделение, отдел или бригаду.');return}openStaffCard(null,n.id);};
  document.querySelector('#structure-assign-cancel').onclick=()=>document.querySelector('#structure-assign-dialog').close();
  document.querySelector('#structure-assign-save').onclick=structureAssignSave;
  document.querySelector('#structure-card-form').onsubmit=structureCardSave;
  document.querySelector('#structure-card-cancel').onclick=()=>document.querySelector('#structure-card-dialog').close();
  document.querySelector('#vacation-charts-open').onclick=vacationChartOpen;
  document.querySelector('#vacation-chart-add').onclick=()=>vacationChartEdit(null);
  document.querySelector('#vacation-charts-close').onclick=()=>document.querySelector('#vacation-charts-dialog').close();
  document.querySelector('#vacation-chart-cancel').onclick=()=>document.querySelector('#vacation-chart-members-dialog').close();
  document.querySelector('#positions-open').onclick=openPositionsDirectory;
  updatePositionSuggestions();
  document.querySelector('#staff-open').onclick=()=>{drawStaff();document.querySelector('#staff-dialog').showModal();};
  document.querySelector('#staff-close').onclick=()=>document.querySelector('#staff-dialog').close();
  document.querySelector('#staff-add').onclick=()=>openStaffCard(null);
  document.querySelector('#staff-view').onclick=()=>{const d=selectedStaff();if(d)openStaffCard(d);};
  document.querySelector('#staff-edit').onclick=()=>{const d=selectedStaff();if(d)openStaffCard(d);};
  document.querySelector('#staff-delete').onclick=()=>{const d=selectedStaff();if(!d)return;if(drivers.length<=1){alert('Нельзя удалить последнего сотрудника.');return;}const count=periodsFor(d.id).length;if(!confirm('Удалить «'+d.name+'» и его отпуска ('+count+')? Это действие нельзя отменить.'))return;drivers=drivers.filter(x=>x.id!==d.id);vacations=vacations.filter(v=>Number(v.driverId)!==d.id);saveStaff();store();selectedStaffId=null;selectedDriverIds=null;drawStaff();render();};

  const groups2026={'Бахметьев':'8','Винник':'8','Данилюк':'9.1','Дунаев':'9.1','Илюхин':'9','Каминик':'11','Карнацкий':'8','Киселев':'1','Кулеш':'11','Ломов':'9','Мальцев':'9.1','Шпаков':'1'};
  const surnamesInDirectory=()=>new Set(drivers.map(d=>staffParts(d).last.trim().toLocaleLowerCase('ru')));
  document.querySelector('#staff-import-2026').onclick=()=>{
    const names=[...new Set(loadHistory().filter(p=>Number(p.year)===2026).map(p=>String(p.driver||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'));
    const existing=surnamesInDirectory();
    document.querySelector('#staff-import-list').innerHTML='<table class="staff-table"><thead><tr><th>Выбор</th><th>Фамилия</th><th>Группа 2026</th><th>Статус</th></tr></thead><tbody>'+names.map(name=>{
      const duplicate=existing.has(name.toLocaleLowerCase('ru'));
      return '<tr><td><input type="checkbox" class="import-2026-person" value="'+escapeHtml(name)+'" '+(duplicate?'disabled':'checked')+'></td><td>'+escapeHtml(name)+'</td><td>'+escapeHtml(groups2026[name]||'Не указана')+'</td><td>'+(duplicate?'Есть в справочнике':'Новый')+'</td></tr>';
    }).join('')+'</tbody></table>';
    const available=names.filter(n=>!existing.has(n.toLocaleLowerCase('ru'))).length;
    document.querySelector('#staff-import-confirm').disabled=!available;
    document.querySelector('#staff-import-status').textContent='Новых сотрудников: '+available+'. Записи 2026 года не изменятся.';
    document.querySelector('#staff-dialog').close();document.querySelector('#staff-import-dialog').showModal();
  };
  document.querySelector('#staff-import-cancel').onclick=()=>{document.querySelector('#staff-import-dialog').close();drawStaff();document.querySelector('#staff-dialog').showModal();};
  document.querySelector('#staff-import-confirm').onclick=()=>{
    const existing=surnamesInDirectory();
    const chosen=[...document.querySelectorAll('.import-2026-person:checked')].map(e=>e.value).filter(n=>!existing.has(n.toLocaleLowerCase('ru')));
    if(!chosen.length)return;
    if(!confirm('Добавить '+chosen.length+' сотрудников? Имена и отчества нужно заполнить вручную.'))return;
    const previous=drivers;
    let nextId=Math.max(0,...drivers.map(d=>Number(d.id)||0));
    drivers=[...drivers,...chosen.map(lastName=>({id:++nextId,name:lastName,lastName,firstName:'',middleName:'',department:'',group:groups2026[lastName]||'Не указана',allowance:36,needsCompletion:true,sourceYear:2026}))];
    try{saveStaff();}catch(err){drivers=previous;document.querySelector('#staff-import-status').textContent='Не удалось сохранить: '+err.message;return;}
    document.querySelector('#staff-import-dialog').close();
    selectedDriverIds=null;
    notice='Из 2026 года добавлено '+chosen.length+' сотрудников. Дополните ФИО и проверьте группы.';
    render();drawStaff();document.querySelector('#staff-dialog').showModal();
  };

  document.querySelector('#staff-card-close').onclick=()=>{document.querySelector('#staff-card').close();drawStaff();document.querySelector('#staff-dialog').showModal();};
  document.querySelector('#staff-form').onsubmit=e=>{
    e.preventDefault();
    const id=Number(document.querySelector('#staff-id').value);
    const lastName=document.querySelector('#staff-last').value.trim(),firstName=document.querySelector('#staff-first').value.trim(),middleName=document.querySelector('#staff-middle').value.trim(),name=lastName+' '+firstName[0]?.toUpperCase()+'.'+(middleName?middleName[0].toUpperCase()+'.':''),department=document.querySelector('#staff-department').value.trim(),group=document.querySelector('#staff-group').value.trim(),position=document.querySelector('#staff-position').value.trim(),allowance=Number(document.querySelector('#staff-allowance').value),hireDate=document.querySelector('#staff-hired').value,dismissalDate=document.querySelector('#staff-dismissal').value,dismissed=document.querySelector('#staff-dismissed').checked||Boolean(dismissalDate);
    if(!lastName||!firstName||!Number.isInteger(allowance)||allowance<1||allowance>120)return;
    if(hireDate&&dismissalDate&&dismissalDate<hireDate){document.querySelector('#staff-error').textContent='Дата увольнения раньше даты приёма.';return;}
    const leaveBreakdown={basic:Number(document.querySelector('#staff-leave-basic').value)||0,territory:Number(document.querySelector('#staff-leave-territory').value)||0,other:Number(document.querySelector('#staff-leave-other').value)||0,legacy:Number(document.querySelector('#staff-leave-legacy').value)||0};
    if(id){const d=drivers.find(x=>x.id===id);Object.assign(d,{name,lastName,firstName,middleName,department,group,position,allowance,leaveBreakdown,hireDate,dismissalDate,dismissed,dayOperations:pendingDayOperations.map(x=>({...x}))});}
    else drivers.push({id:Math.max(0,...drivers.map(d=>d.id))+1,name,lastName,firstName,middleName,department,group,position,allowance,hireDate,dismissalDate,dismissed,dayOperations:pendingDayOperations.map(x=>({...x})),...(e.currentTarget.dataset.structureId?{structureId:e.currentTarget.dataset.structureId}:{})});
    const fromStructure=e.currentTarget.dataset.fromStructure==='1';
    const selectedStructureId=e.currentTarget.dataset.structureId;
    saveStaff();
    document.querySelector('#staff-card').close();
    if(fromStructure)document.querySelector('#structure-dialog').close();
    render();drawStaff();
    if(fromStructure){
      document.querySelector('#structure-tree').dataset.selectedId=selectedStructureId;
      structureOpen();
    }else document.querySelector('#staff-dialog').showModal();
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
  document.querySelector('#service-messages-open').onclick=()=>document.querySelector('#service-messages-dialog').showModal();
  document.querySelector('#service-messages-close').onclick=()=>document.querySelector('#service-messages-dialog').close();
  document.querySelector('#chart-info-open').onclick=()=>document.querySelector('#chart-info-dialog').showModal();
   document.querySelector('#chart-info-close').onclick=()=>document.querySelector('#chart-info-dialog').close();
   document.querySelector('#help-open').onclick=()=>document.querySelector('#help-dialog').showModal();
  document.querySelector('#about-open').onclick=showAboutGrot;
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
  document.querySelectorAll('.grot-menu').forEach(menu=>{
    menu.addEventListener('toggle',()=>{if(menu.open)document.querySelectorAll('.grot-menu').forEach(other=>{if(other!==menu)other.open=false;});});
    menu.querySelectorAll('.grot-menu-panel button').forEach(b=>b.addEventListener('click',()=>{menu.open=false;}));
  });
  document.querySelector('#collapse-month').onclick=()=>{expandedMonths.clear();render();};
  document.querySelectorAll('[data-month]').forEach(el=>el.onclick=()=>{const m=Number(el.dataset.month);if(expandedMonths.has(m))expandedMonths.delete(m);else expandedMonths.add(m);selectedMonth=m;render();});
  document.querySelector('#seasonality-open').onclick=()=>openSeasonality(2027);
  document.querySelector('#priority-calculate').onclick=calculateChartPriority;
  document.querySelectorAll('[data-conflict-id]').forEach(b=>b.onclick=()=>{
    const d=drivers.find(x=>String(x.id)===b.dataset.conflictId);
    const entries=groupConflicts.get(String(b.dataset.conflictId))||[];
    alert('Пересечения отпусков в группе '+(d?.group||'—')+' для '+(d?shortStaffName(d):'сотрудника')+':\n\n'+entries.join('\n'));
  });
  document.querySelectorAll('[data-priority-id]').forEach(b=>b.onclick=()=>showPriorityDetails(b.dataset.priorityId));
  document.querySelectorAll('[data-edit-group]').forEach(b=>b.onclick=()=>{
    const d=drivers.find(x=>String(x.id)===b.dataset.editGroup);if(!d)return;
    const answer=prompt('Группа отпусков для '+shortStaffName(d)+' (например, 1 или 2). Пустая группа — без ограничений по пересечению отпусков:',d.group||'');
    if(answer===null)return;
    const group=answer.trim();
    if(group.length>30){alert('Номер группы не должен превышать 30 символов.');return}
    if(group===String(d.group||''))return;
    d.group=group;saveStaff();
    notice='Группа сотрудника '+shortStaffName(d)+' изменена на '+(group||'«без группы»')+'.';
    render();
  });
  document.querySelector('#app-refresh').onclick=()=>location.reload();
  document.querySelector('#grot-year').onchange=e=>{displayYear=Number(e.target.value);render()};
  const dialog = document.querySelector('#editor');
  const driverCard=document.querySelector('#driver-card');
  let currentDriver=drivers[0].id;
  let rangeMonth=selectedMonth, rangeStep=0, draftPeriods=[], selectedDraft=-1, changingDraft=-1, editorMode="view";
  // Drag the vacation editor by its title, using mouse or touch.
  const editorHeader=dialog.querySelector('.editor-header');
  let drag=null;
  editorHeader.addEventListener('pointerdown',e=>{
    if(e.button!==0||e.target.closest('button,input,select,a'))return;
    const rect=dialog.getBoundingClientRect();
    dialog.style.margin='0';
    dialog.style.position='fixed';
    dialog.style.left=rect.left+'px';
    dialog.style.top=rect.top+'px';
    drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:rect.left,top:rect.top};
    editorHeader.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  editorHeader.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.id)return;
    const x=Math.max(0,Math.min(window.innerWidth-dialog.offsetWidth,drag.left+e.clientX-drag.x));
    const y=Math.max(0,Math.min(window.innerHeight-dialog.offsetHeight,drag.top+e.clientY-drag.y));
    dialog.style.left=x+'px';dialog.style.top=y+'px';
  });
  const stopDrag=e=>{if(drag&&e.pointerId===drag.id){drag=null;if(editorHeader.hasPointerCapture(e.pointerId))editorHeader.releasePointerCapture(e.pointerId)}};
  editorHeader.addEventListener('pointerup',stopDrag);
  editorHeader.addEventListener('pointercancel',stopDrag);
  dialog.addEventListener('close',()=>{drag=null;dialog.style.removeProperty('left');dialog.style.removeProperty('top');dialog.style.removeProperty('margin');dialog.style.removeProperty('position')});
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
    document.querySelector('#period-total').textContent='Доступно: '+availableLeaveDays(driver)+' · Запланировано: '+planned+' · Осталось: '+(availableLeaveDays(driver)-planned)+' дн. (праздники исключены)';
    document.querySelector('#driver-add').disabled=planned>=availableLeaveDays(driver);
    document.querySelector('#driver-add').title=planned>=availableLeaveDays(driver)?'Все дни отпуска уже запланированы':'';
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
  document.querySelector('#person').onchange=()=>{draftPeriods=periodsFor(Number(document.querySelector('#person').value)).map(p=>({start:p.start,end:p.end}));rangeStep=0;drawRangeCalendar();updateCount();};
  document.querySelectorAll('[data-driver]').forEach(el=>el.onclick=()=>openEditor(Number(el.dataset.driver),null,true));
  document.querySelector('#driver-history').onclick=()=>showDriverHistory(shortStaffName(drivers.find(d=>Number(d.id)===Number(currentDriver))||{}));
  document.querySelector('#editor-history').onclick=()=>{const id=Number(document.querySelector('#person').value);const driver=drivers.find(d=>Number(d.id)===id);if(driver)showDriverHistory(shortStaffName(driver));};
  document.querySelector('#driver-close').onclick=()=>driverCard.close();
  document.querySelector('#driver-add').onclick=()=>{driverCard.close();openEditor(currentDriver,null,true);};
  function updateEditorMode(){
    document.querySelector('#mode-add').disabled=editorMode==='add';
    document.querySelector('#mode-edit').disabled=editorMode==='edit';
    document.querySelector('#mode-delete').disabled=editorMode==='delete';
    document.querySelector('#vacation-form button[type="submit"]').hidden=editorMode==='view';
    document.querySelector('#range-hint').textContent=editorMode==='view'?'':editorMode==='add'?'Выберите начало и окончание нового периода.':editorMode==='edit'?'Нажмите на существующий отпуск для изменения дат.':'Нажмите на период, который нужно удалить.';
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
    const remain=(driver?availableLeaveDays(driver):36)-planned;
    document.querySelector('#day-count').textContent='Доступно: '+(driver?availableLeaveDays(driver):36)+' · Запланировано: '+planned+' · Осталось: '+remain+' дн.';
    document.querySelector('#editor-split-warning').textContent=combined.length>0&&!combined.some(p=>leaveDays(p.start,p.end)>=14)?'⚠ Нет ни одной части отпуска продолжительностью не менее 14 дней. Перед утверждением графика необходимо исправить.':'';
    document.querySelector('#form-error').textContent=remain<0?'Предупреждение: превышение на '+(-remain)+' дн. Периоды можно сохранить, фамилия будет выделена красным.':'';
    document.querySelector('#vacation-form button[type="submit"]').disabled=editorMode==='view';
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
  document.querySelector('#editor-close-x').onclick=()=>dialog.close();
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
    const excess=sorted.reduce((n,p)=>n+leaveDays(p.start,p.end),0)-availableLeaveDays(driver);
    if(excess>0&&!confirm('Запланировано сверх доступного на '+excess+' дн. Сохранить с предупреждением?'))return;
    vacations=vacations.filter(v=>Number(v.driverId)!==id).concat(sorted.map(p=>({driverId:id,start:p.start,end:p.end})));
    store();
    notice='Период отпуска сохранён.';
    dialog.close();
    render();
  };
  document.querySelectorAll('[data-date]').forEach(cell=>cell.onclick=()=>openEditor(Number(cell.dataset.id),null,true));
}
render();
