import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('el perfil de una cuenta no admin no busca controles del editor de días que no existe', async () => {
  const profile = await readFile(new URL('../tamp/src/pages/Profile.js', import.meta.url), 'utf8');

  assert.ok(
    /if \(daysEditor\) \{\s*editDaysBtn\?\.addEventListener\('click', openDaysEditor\);[\s\S]*?daysEditor\.querySelector\('#pdCancel'\)[\s\S]*?\}/.test(profile),
    'los enlaces del editor exclusivo del admin deben montarse solo si el editor está en el perfil'
  );
});
