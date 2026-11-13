/**
 * ГРОТ 2.0. Безопасная модель отпусков по годам.
 * Чистые функции: никакой записи в localStorage, автоматической миграции
 * или изменения исходных объектов.
 */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function makeDateRange(start, end, year) {
  if (!isValidDate(start) || !isValidDate(end) || end < start)
    throw new RangeError('Некорректные даты отпускного периода');
  const y = Number(year);
  if (!Number.isInteger(y) || y < 2000 || y > 2200)
    throw new RangeError('Некорректный год графика');
  if (Number(start.slice(0, 4)) !== y)
    throw new RangeError('Начало отпуска относится к другому году');
  return Object.freeze({start, end});
}

function yearOf(row) { return Number(row.year ?? String(row.start || '').slice(0, 4)); }
function identity(row, prefix, ordinal) {
  // Legacy source can lack an identifier; ordinal prevents collisions among duplicates.
  const id = row.id == null ? `${prefix}:${ordinal}` : `${prefix}:${String(row.id)}`;
  return id;
}
function legacyName(row) { return String(row.driver || row.staffName || '').trim(); }
function legacyPeriod(row, year) {
  try { return makeDateRange(row.start, row.end, year); } catch { return null; }
}

/**
 * Historical rows do not reliably indicate whether dates were planned or taken.
 * Store them in 'unclassified', never silently assume fact or plan.
 * Current 2027 rows are marked as plan ONLY, never copied into fact.
 */
export function previewLegacyMigration({working2027=[], history=[], staff=[]}={}) {
  const records = [], warnings = [];
  const roster = Array.isArray(staff) ? staff : [];
  function matchPerson(name) {
    const normalized = v => String(v || '').trim().toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/\s+/g,' ');
    const key = normalized(name);
    if (!key) return null;
    const matches = roster.filter(p => normalized(p.name || [p.lastName,p.firstName,p.middleName].filter(Boolean).join(' ')) === key);
    return matches.length === 1 ? String(matches[0].id) : null;
  }
  for (const [kind, rows, source] of [
    ['plan', working2027, 'vacations2027'],
    ['unclassified', history, 'grot-seasonality-history-v1']
  ]) {
    if (!Array.isArray(rows)) { warnings.push(`Источник ${source} не является массивом`); continue; }
    rows.forEach((row, index) => {
      const year = kind === 'plan' ? 2027 : yearOf(row);
      const range = legacyPeriod(row,year);
      if (!range) {
        warnings.push(`Пропущена запись ${source} №${index + 1}: некорректные даты`);
        return;
      }
      const personId = row.driverId != null ? String(row.driverId) : matchPerson(legacyName(row));
      if (personId === null) warnings.push(`Требуется сверка сотрудника: ${source} №${index+1}`);
      records.push({
        id:identity(row,source,index),
        year, chartId:kind === 'plan' ? 'legacy-2027' : null,
        staffId:personId, staffName:legacyName(row),
        source, sourceIndex:index,
        plan:kind === 'plan' ? {...range} : null,
        fact:null,
        unclassified:kind === 'unclassified' ? {...range} : null,
        audit:[]
      });
    });
  }
  return {schemaVersion:2, records, warnings, sourceCounts:{
    working2027:Array.isArray(working2027)?working2027.length:0,
    history:Array.isArray(history)?history.length:0
  }};
}

/** Assign real usage dates only after a verified explicit user action. */
export function setFact(record, range, {actor, reason, at}={}) {
  if (!actor || !reason || !at) throw new Error('Требуются автор, причина и время изменения');
  const fact = makeDateRange(range.start,range.end,record.year);
  return {
    ...record,
    fact:{...fact},
    audit:[...(record.audit || []), {
      field:'fact', previous:record.fact ? {...record.fact} : null,
      next:{...fact}, actor:String(actor), reason:String(reason), at:String(at)
    }]
  };
}
