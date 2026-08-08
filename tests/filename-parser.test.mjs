import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isComplete,
  pairingKey,
  parseFilename,
} from '../tools/lib/filename-parser.mjs';

const cases = [
  ['AP1-Winter-2023.pdf', 'AP1', 2023, 'Winter'],
  ['AP2_GA1_Sommer_2022.pdf', 'GA1', 2022, 'Sommer'],
  ['FiAE AP2 GA2 Winter 2024.pdf', 'GA2', 2024, 'Winter'],
  ['WiSo_W23.pdf', 'WiSo', 2023, 'Winter'],
  ['Pruefung-S24-GA1.pdf', 'GA1', 2024, 'Sommer'],
  ['ap_it_sommer2009_ga1_fiae.pdf', 'GA1', 2009, 'Sommer'],
  ['FI-AE_Abschlusspruefung_GA1_Sommer2008.pdf', 'GA1', 2008, 'Sommer'],
  ['AP S2012 IT GA1 FIAE.pdf', 'GA1', 2012, 'Sommer'],
  ['AP2_T1_FIAE_S2025.pdf', 'GA1', 2025, 'Sommer'],
];

test('liest die dokumentierten Prüfungs-Dateinamen vollständig', () => {
  for (const [filename, examPart, examYear, examSeason] of cases) {
    const actual = parseFilename(filename);
    assert.equal(actual.exam_part, examPart, filename);
    assert.equal(actual.exam_year, examYear, filename);
    assert.equal(actual.exam_season, examSeason, filename);
    assert.equal(isComplete(actual), true, filename);
  }
});

test('erkennt Lösungsdateien und bildet denselben Paarungsschlüssel', () => {
  const task = 'GA_2_Fi_beide.pdf';
  const solution = 'Lösung_GA_2_Fi_beide.pdf';

  assert.equal(parseFilename(task).isSolution, false);
  assert.equal(parseFilename(solution).isSolution, true);
  assert.equal(pairingKey(task), pairingKey(solution));
});

test('meldet unvollständige Metadaten zuverlässig', () => {
  assert.equal(isComplete(parseFilename('GA_1_FiAe.pdf')), false);
  assert.equal(isComplete(parseFilename('unbekannt.pdf')), false);
});
