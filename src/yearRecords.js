// Read-only adapter: old history and active vacations share one annual record shape.
// Source browser data is never changed by this module.
const normal = value => String(value || '').trim().toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ');
function resolveLegacyPerson(name, staff) {
  const key = normal(name);
  if (!key) return null;
  const exact = staff.filter(d => [d.name, [d.lastName,d.firstName,d.middleName].filter(Boolean).join(' ')].some(n => normal(n) === key));
  if (exact.length === 1) return exact[0];
  if (exact.length > 1 || key.includes(' ')) return null;
  const surname = staff.filter(d => normal(d.lastName || String(d.name || '').trim().split(/\s+/)[0]) === key);
  return surname.length === 1 ? surname[0] : null;
}
export function readAnnualVacationRecords(year, {current=[], historical=[], staff=[]}={}) {
  const y=Number(year);
  if (!Number.isInteger(y) || y<2000 || y>2200) return [];
  const active=y===2027;
  return (active?current:historical).filter(p =>
    Number(p.year || String(p.start || '').slice(0,4))===y &&
    /^\d{4}-\d{2}-\d{2}$/.test(p.start || '') &&
    /^\d{4}-\d{2}-\d{2}$/.test(p.end || '') &&
    p.end>=p.start
  ).map(p => {
    const person=active
      ? staff.find(d=>String(d.id)===String(p.driverId))
      : resolveLegacyPerson(p.driver,staff);
    const name=active?(person?.name || ''):p.driver;
    return {...p,year:y,driver:name,staffName:name,staffId:person?.id??null,source:active?'vacations2027':'history'};
  });
}
