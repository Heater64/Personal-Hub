import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const gamesDir = path.resolve('tamp/public/games');

test('los minijuegos permiten ampliar la página con los controles del navegador', async () => {
  const files = (await readdir(gamesDir)).filter(file => file.endsWith('.html'));
  const restricted = [];

  for (const file of files) {
    const html = await readFile(path.join(gamesDir, file), 'utf8');
    if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:\.0)?(?:\s*[,;]|\s*"|$)/i.test(html)) {
      restricted.push(file);
    }
  }

  assert.deepEqual(restricted, [], `juegos que bloquean el zoom: ${restricted.join(', ')}`);
});
