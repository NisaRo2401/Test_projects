import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const importer = resolve('tools/insert-questions.mjs');

function validDocument() {
  return {
    source_pdf: 'AP1-Sommer-2026.pdf',
    exam_part: 'AP1',
    exam_year: 2026,
    exam_season: 'Sommer',
    questions: [{
      topic: 'Datenbanken',
      question: 'Welche Aussage ist korrekt?',
      options: ['A', 'B', 'C', 'D'],
      correct_indices: [1],
      solution: 'Antwort B ist korrekt.',
      difficulty: 'leicht',
      source_page: 1,
    }],
  };
}

async function runDryImport(document) {
  const directory = await mkdtemp(join(tmpdir(), 'lernhub-import-'));
  const file = join(directory, 'fixture.questions.json');
  try {
    await writeFile(file, JSON.stringify(document), 'utf8');
    return spawnSync(process.execPath, [importer, '--file', file, '--dry-run'], {
      encoding: 'utf8',
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('Fragenimport akzeptiert eine vollständige Datei im Dry-Run', async () => {
  const result = await runDryImport(validDocument());
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /dry-run/i);
});

test('Fragenimport liefert bei ungültigen Daten einen Fehlercode', async () => {
  const document = validDocument();
  document.exam_year = 1998;
  document.questions[0].correct_indices = [1, 1];

  const result = await runDryImport(document);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /exam_year/i);
});
