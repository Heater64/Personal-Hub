/* Contrato de los campos de fecha en español: día, mes, año. */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  displayToDateTime,
  displayToISO,
  isoDateTimeToDisplay,
  isoToDisplay,
  maskDateInput,
} from '../personal-hub/src/utils/datefield.js';

test('una fecha ISO se lee día/mes/año', () => {
  assert.equal(isoToDisplay('2026-11-18'), '18/11/2026');
  assert.equal(isoToDisplay('2026-01-02'), '02/01/2026');
  assert.equal(isoToDisplay(''), '');
  assert.equal(isoToDisplay('noviembre'), '');
});

test('lo que se escribe vuelve a ISO, sin importar el separador', () => {
  assert.equal(displayToISO('18/11/2026'), '2026-11-18');
  assert.equal(displayToISO('18-11-2026'), '2026-11-18');
  assert.equal(displayToISO('18.11.2026'), '2026-11-18');
  assert.equal(displayToISO('1/2/26'), '2026-02-01');
  assert.equal(displayToISO('2026-11-18'), '2026-11-18');
  assert.equal(displayToISO(''), '');
});

test('una fecha imposible no se traga', () => {
  assert.equal(displayToISO('31/02/2026'), null);
  assert.equal(displayToISO('18/13/2026'), null);
  assert.equal(displayToISO('00/11/2026'), null);
  assert.equal(displayToISO('18/11'), null);
});

test('las barras salen solas mientras se escribe', () => {
  assert.equal(maskDateInput('18112026'), '18/11/2026');
  assert.equal(maskDateInput('18'), '18');
  assert.equal(maskDateInput('18/'), '18/');
  assert.equal(maskDateInput('1811'), '18/11');
  assert.equal(maskDateInput('181120262030', { withTime: true }), '18/11/2026 20:30');
});

test('fecha y hora se escriben juntas y en orden español', () => {
  assert.equal(isoDateTimeToDisplay('2026-11-18T20:30'), '18/11/2026 20:30');
  assert.equal(displayToDateTime('18/11/2026 20:30'), '2026-11-18T20:30');
  assert.equal(displayToDateTime('18/11/2026'), '2026-11-18T00:00');
  assert.equal(displayToDateTime(''), '');
});
