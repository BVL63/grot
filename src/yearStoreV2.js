/**
 * ГРОТ 2.0 — independent yearly data storage.
 * No migration, writes or removals occur on module import or on read.
 * Old 2025–2027 storage keys are never modified by this module.
 */
export const YEAR_STORE_PREFIX='grot-year-v2:';
const minYear=2000,maxYear=2200;
const validYear=year=>{
 const y=Number(year);
 if(!Number.isInteger(y)||y<minYear||y>maxYear)throw new RangeError('Некорректный год графика');
 return y;
};
const clone=value=>JSON.parse(JSON.stringify(value));
const isPlainObject=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const dateOk=(date,year)=>{
 if(typeof date!=='string'||!new RegExp('^'+year+'-\\d{2}-\\d{2}$').test(date))return false;
 const parsed=new Date(date+'T12:00:00Z');
 return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===date;
};
function normalizePlan(year,source){
 const plan=isPlainObject(source)?source:{};
 return {
  year,
  staffIds:Array.isArray(plan.staffIds)?clone(plan.staffIds):[],
  charts:Array.isArray(plan.charts)?clone(plan.charts):[],
  periods:Array.isArray(plan.periods)?clone(plan.periods):[],
  calendarOverrides:isPlainObject(plan.calendarOverrides)?clone(plan.calendarOverrides):{},
  meta:isPlainObject(plan.meta)?clone(plan.meta):{}
 };
}
function validatePlan(year,plan){
 if(!isPlainObject(plan)||Number(plan.year)!==year)throw new Error('Год записи не совпадает с выбранным годом');
 if(!Array.isArray(plan.staffIds)||!Array.isArray(plan.charts)||!Array.isArray(plan.periods)||!isPlainObject(plan.calendarOverrides)||!isPlainObject(plan.meta))throw new Error('Неверная структура годового графика');
 for(const period of plan.periods){
  if(!isPlainObject(period)||!dateOk(period.start,year)||!dateOk(period.end,year)||period.end<period.start)throw new Error('Некорректный период отпуска для '+year+' года');
 }
 for(const [date,type] of Object.entries(plan.calendarOverrides)){
  if(!dateOk(date,year)||!['holiday','weekend','workday'].includes(type))throw new Error('Некорректная запись производственного календаря');
 }
}
/**
 * Legacy reader is injected so previous years can be shown without copying
 * ambiguous surname-only records to employee IDs.
 *
 * @param {Storage} storage A browser Storage-compatible object.
 * @param {Object} options
 * @param {(year: number)=>Object|null} options.readLegacyYear Read-only legacy adapter.
 */
export function createYearStore(storage,{readLegacyYear=()=>null}={}){
 if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function')throw new TypeError('Хранилище недоступно');
 const key=year=>YEAR_STORE_PREFIX+validYear(year);
 function hasYear(year){return storage.getItem(key(year))!==null;}
 function readYear(year){
  const y=validYear(year),raw=storage.getItem(key(y));
  if(raw!==null){
   let saved;
   try{saved=JSON.parse(raw);}catch{throw new Error('Данные '+y+' года повреждены — запись заблокирована');}
   validatePlan(y,saved);
   return clone(saved);
  }
  const legacy=readLegacyYear(y);
  const result=normalizePlan(y,legacy);
  validatePlan(y,result);
  return result;
 }
 function writeYear(year,patch){
  const y=validYear(year),base=readYear(y);
  const change=typeof patch==='function'?patch(clone(base)):patch;
  if(!isPlainObject(change))throw new TypeError('Изменения должны быть объектом');
  if(Object.prototype.hasOwnProperty.call(change,'year')&&Number(change.year)!==y)throw new Error('Нельзя записать данные другого года');
  const next={...base,...clone(change),year:y};
  validatePlan(y,next);
  storage.setItem(key(y),JSON.stringify(next));
  return clone(next);
 }
 function createYear(year,{fromYear=year-1,staffIds,charts}={}){
  const y=validYear(year),prev=validYear(fromYear);
  if(hasYear(y))throw new Error('График '+y+' года уже существует');
  const source=readYear(prev);
  const ids=staffIds===undefined?source.staffIds:staffIds;
  const lists=charts===undefined?source.charts:charts;
  const next=normalizePlan(y,{
   staffIds:ids,
   charts:lists.map(chart=>({...chart,year:y,approval:null,status:'draft',exceptions:[]})),
   periods:[],
   calendarOverrides:{},
   meta:{createdAt:new Date().toISOString(),sourceYear:prev,status:'draft'}
  });
  validatePlan(y,next);
  storage.setItem(key(y),JSON.stringify(next));
  return clone(next);
 }
 function listYears(){
  const years=[];
  for(let i=0;i<storage.length;i++){
   const item=storage.key(i);
   if(typeof item!=='string'||!item.startsWith(YEAR_STORE_PREFIX))continue;
   const suffix=item.slice(YEAR_STORE_PREFIX.length),y=Number(suffix);
   if(String(y)===suffix&&Number.isInteger(y)&&y>=minYear&&y<=maxYear)years.push(y);
  }
  return years.sort((a,b)=>a-b);
 }
 return {readYear,writeYear,createYear,hasYear,listYears,key};
}
