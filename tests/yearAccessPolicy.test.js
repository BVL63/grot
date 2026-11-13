import test from 'node:test';
import assert from 'node:assert/strict';
import { yearAccessPolicy } from '../src/yearAccessPolicy.js';

test('Все годы используют одну форму', () => {
  for (const year of [2025, 2026, 2027, 2028]) {
    assert.equal(yearAccessPolicy({year, calendarYear:2026}).form, 'unified');
  }
});

test('Прошедший год требует режима корректировки', () => {
  const base={year:2025, calendarYear:2026, role:'administrator'};
  assert.equal(yearAccessPolicy(base).readOnly,true);
  assert.equal(yearAccessPolicy({...base,correctionMode:true}).canCorrect,true);
});

test('План на следующий год можно править до утверждения', () => {
  const p=yearAccessPolicy({year:2027,calendarYear:2026,role:'administrator'});
  assert.equal(p.canEditPlan,true);
});

test('Утверждать вправе руководитель только в локальной сети', () => {
  const base={year:2027,calendarYear:2026,role:'manager'};
  assert.equal(yearAccessPolicy(base).canApprove,false);
  assert.equal(yearAccessPolicy({...base,localNetwork:true}).canApprove,true);
  assert.equal(yearAccessPolicy({...base,localNetwork:true,status:'approved'}).canApprove,false);
});

test('Администратор не утверждает', () => {
  assert.equal(yearAccessPolicy({year:2027,calendarYear:2026,role:'administrator',localNetwork:true}).canApprove,false);
});
