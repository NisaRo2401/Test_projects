import assert from 'node:assert/strict';
import test from 'node:test';

import { ocrPages, stripOcrNoise } from '../tools/lib/ocr-runner.mjs';

function fakeWorker(name, delay) {
  let busy = false;
  return {
    async recognize(path) {
      assert.equal(busy, false, `${name} wurde gleichzeitig mehrfach verwendet.`);
      busy = true;
      try {
        await new Promise(resolve => setTimeout(resolve, delay));
        return { data: { text: `  ${path}\n\n\n`, confidence: 91.6 } };
      } finally {
        busy = false;
      }
    },
  };
}

test('OCR-Worker verarbeiten Seiten parallel, aber jeden Worker nur einmal', async () => {
  const pages = Array.from({ length: 7 }, (_, index) => ({
    role: 'task',
    page: index + 1,
    png: `page-${index + 1}.png`,
  }));
  const progress = [];

  const results = await ocrPages(
    pages,
    '/tmp/ocr-test',
    [fakeWorker('schnell', 1), fakeWorker('langsam', 4)],
    { onProgress: (done, total) => progress.push([done, total]) },
  );

  assert.deepEqual(results.map(result => result.page), [1, 2, 3, 4, 5, 6, 7]);
  assert.ok(results.every(result => result.confidence === 92));
  assert.deepEqual(progress.at(-1), [7, 7]);
});

test('OCR-Text wird deterministisch bereinigt', () => {
  assert.equal(stripOcrNoise(' A  \r\n\n\n\nB \t\n'), 'A\n\nB');
});
