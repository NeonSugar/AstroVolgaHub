import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

const projectRoot = new URL('..', import.meta.url).pathname;
const cityCounters = {
  melitopol: 113123680,
  berdyansk: 113123707,
  energodar: 113123722,
  tokmak: 113123742,
  vasilevka: 113123762,
  kamenka: 113123779,
  primorsk: 113123799,
  veseloe: 113123822,
  znamenka: 113123857
};

test('each city landing loads its own Yandex Metrika script and counter', async () => {
  for (const [city, counterId] of Object.entries(cityCounters)) {
    const [html, script] = await Promise.all([
      readFile(join(projectRoot, city, 'index.html'), 'utf8'),
      readFile(join(projectRoot, city, 'yandex-metrika.js'), 'utf8')
    ]);

    assert.match(html, new RegExp(`src="/${city}/yandex-metrika\\.js(?:\\?[^\"]+)?"`));
    assert.doesNotMatch(html, /src="\/yandex-metrika\.js/);
    assert.match(script, new RegExp(`const counterId = ${counterId};`));
  }
});
