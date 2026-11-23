import test from 'node:test';
import assert from 'node:assert/strict';
import { formatReminderDate, isoToLocalInput, localInputToIso } from '../tamp/src/utils/reminder-time.js';

test('round-trips Spain wall time independent of the machine timezone', () => {
  const instant = localInputToIso('2026-11-23T12:34');
  assert.equal(instant, '2026-11-23T11:34:00.000Z');
  assert.equal(isoToLocalInput(instant), '2026-11-23T12:34');
  assert.match(formatReminderDate(instant), /23 nov 2026, 12:34/i);
});

test('rejects invalid dates and wall times skipped by the spring DST change', () => {
  assert.throws(() => localInputToIso('2026-02-30T10:00'), /fecha y hora válidas/i);
  assert.throws(() => localInputToIso('2026-03-29T02:30'), /cambio horario/i);
});

test('chooses the first occurrence for ambiguous autumn wall times', () => {
  assert.equal(localInputToIso('2026-10-25T02:30'), '2026-10-25T00:30:00.000Z');
});
