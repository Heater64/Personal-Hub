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

test('el foco de teclado se conserva y se reducen las animaciones del sitio', async () => {
  const css = await readFile(path.resolve('tamp/src/styles/motion.css'), 'utf8');
  const focusSelector = ':where(a, button, input, select, textarea, [tabindex]):focus-visible';
  const focusIndex = css.indexOf(focusSelector);
  const beforeFocus = css.slice(0, focusIndex).replace(/\/\*[\s\S]*?\*\//g, '');
  const braceDepth = [...beforeFocus].reduce((depth, char) =>
    char === '{' ? depth + 1 : char === '}' ? depth - 1 : depth, 0);

  assert.ok(focusIndex >= 0, 'debe existir un anillo de foco para controles interactivos');
  assert.equal(braceDepth, 0, 'el anillo de foco no debe depender de la preferencia de movimiento');
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?transition-duration:\s*0\.01ms\s*!important/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?transition-delay:\s*0ms\s*!important/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?animation-duration:\s*0\.01ms\s*!important/);
});

test('los campos del editor de episodios conservan un foco visible', async () => {
  const css = await readFile(path.resolve('tamp/src/styles/series.css'), 'utf8');
  assert.match(css, /\.sr-ep-input:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--theme-accent\)/);
});

test('una imagen fallida conserva el fallback hasta que termina su onerror', async () => {
  const previous = {
    document: globalThis.document,
    HTMLImageElement: globalThis.HTMLImageElement,
    MutationObserver: globalThis.MutationObserver,
  };
  const listeners = [];

  class FakeImage {
    constructor() {
      this.style = {};
      this.parentElement = { classList: { add() {} } };
      this.nextElementSibling = {
        classList: { contains: (name) => name === 'tile__fallback' },
        style: { display: 'none' },
      };
      this.removed = false;
    }

    remove() {
      this.removed = true;
      this.parentElement = null;
      this.nextElementSibling = null;
    }
  }

  globalThis.document = {
    addEventListener(type, listener) {
      if (type === 'error') listeners.push(listener);
    },
    querySelectorAll: () => [],
    documentElement: {},
  };
  globalThis.HTMLImageElement = FakeImage;
  globalThis.MutationObserver = class {
    observe() {}
  };

  try {
    const { installImageReveal } = await import('../tamp/src/utils/imageReveal.js');
    installImageReveal();

    const image = new FakeImage();
    const fallback = image.nextElementSibling;
    listeners.at(-1)({ target: image });

    assert.doesNotThrow(() => {
      image.style.display = 'none';
      image.nextElementSibling.style.display = 'flex';
    });
    assert.equal(fallback.style.display, 'flex');

    await new Promise(queueMicrotask);
    assert.equal(image.removed, true);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});
