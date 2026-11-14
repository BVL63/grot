/**
 * GROT 2.0 — lossless preparation only. This module never reads or writes
 * browser storage. The caller must supply an independently exported backup.
 * Every original source row is retained, including rows with invalid dates.
 */
import {previewLegacyMigration} from './vacationModelV2.js';

const clone=value=>JSON.parse(JSON.stringify(value));
const SOURCES=['vacations2027','grot-seasonality-history-v1','vacationStaff2027','grotVacationCharts'];

export function prepareLosslessMigration({working2027=[],history=[],staff=[],charts=[]}={}){
  const input={
    vacations2027:clone(working2027),
    'grot-seasonality-history-v1':clone(history),
    vacationStaff2027:clone(staff),
    grotVacationCharts:clone(charts)
  };
  for(const key of SOURCES){
    if(!Array.isArray(input[key]))throw new TypeError('Источник не является массивом: '+key);
  }
  const preview=previewLegacyMigration({working2027,history,staff});
  const imported=new Set(preview.records.map(r=>r.source+':'+r.sourceIndex));
  const retained=[];
  for(const key of SOURCES.slice(0,2)){
    input[key].forEach((raw,index)=>retained.push({
      source:key,index,raw,converted:imported.has(key+':'+index)
    }));
  }
  const missing=retained.filter(r=>!r.converted);
  return {
    schemaVersion:2,
    readyForActivation:missing.length===0&&preview.warnings.length===0,
    preview,
    originalSources:input,
    retainedSourceRows:retained,
    unconvertedRows:missing,
    counts:{
      originalVacationRows:retained.length,
      convertedVacationRows:preview.records.length,
      retainedVacationRows:retained.length,
      staff:input.vacationStaff2027.length,
      charts:input.grotVacationCharts.length
    }
  };
}

export function verifyLosslessMigration(prepared){
  if(!prepared || !Array.isArray(prepared.retainedSourceRows) ||
     !Array.isArray(prepared.preview?.records))return false;
  return prepared.counts.originalVacationRows===prepared.retainedSourceRows.length &&
    prepared.counts.retainedVacationRows===prepared.retainedSourceRows.length &&
    prepared.counts.convertedVacationRows===prepared.preview.records.length &&
    prepared.retainedSourceRows.every(r=>Object.prototype.hasOwnProperty.call(r,'raw'));
}
