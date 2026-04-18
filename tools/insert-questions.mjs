#!/usr/bin/env node
// Stufe 3: fertige MC-Fragen-JSONs → Supabase `questions`-Tabelle.
// Akzeptiert EINE Datei (--file) ODER einen ganzen Ordner (--dir).
//
// Usage:
//   node insert-questions.mjs --file ./output/X.questions.json
//   node insert-questions.mjs --dir  ./output/           # alle *.questions.json

import 'dotenv/config';
import { parseArgs } from 'node:util';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, join, extname, basename } from 'node:path';
import { upsertQuestion } from './lib/supabase-writer.mjs';

const { values } = parseArgs({
  options: {
    file: { type: 'string' },
    dir:  { type: 'string' },
    help: { type: 'boolean', default: false, short: 'h' },
    'dry-run': { type: 'boolean', default: false },
  },
});

if (values.help || (!values.file && !values.dir)) {
  console.error(`
Usage:
  node insert-questions.mjs --file <path.questions.json>
  node insert-questions.mjs --dir  <folder>              # alle *.questions.json

Optionale Flags:
  --dry-run   validiert nur, schreibt nichts
`);
  process.exit(values.help ? 0 : 1);
}

const VALID_PARTS   = ['AP1', 'GA1', 'GA2', 'WiSo'];
const VALID_SEASONS = ['Sommer', 'Winter'];
const VALID_DIFFS   = ['leicht', 'mittel', 'schwer'];

function validateFile(doc) {
  if (!doc.source_pdf) throw new Error('source_pdf fehlt');
  if (!VALID_PARTS.includes(doc.exam_part)) throw new Error(`exam_part ungültig: ${doc.exam_part}`);
  if (!VALID_SEASONS.includes(doc.exam_season)) throw new Error(`exam_season ungültig: ${doc.exam_season}`);
  if (!Number.isInteger(doc.exam_year)) throw new Error('exam_year muss Integer sein');
  if (!Array.isArray(doc.questions) || doc.questions.length === 0) {
    throw new Error('questions[] fehlt oder leer');
  }
}

function validateQuestion(q, idx) {
  const prefix = `[Frage ${idx + 1}]`;
  const required = ['topic', 'question', 'options', 'correct_indices', 'solution', 'difficulty'];
  for (const k of required) {
    if (q[k] === undefined || q[k] === null) throw new Error(`${prefix} Pflichtfeld fehlt: ${k}`);
  }
  if (!Array.isArray(q.options) || q.options.length !== 4) {
    throw new Error(`${prefix} options muss genau 4 Einträge haben`);
  }
  if (!Array.isArray(q.correct_indices) || q.correct_indices.length === 0) {
    throw new Error(`${prefix} correct_indices darf nicht leer sein`);
  }
  for (const i of q.correct_indices) {
    if (!Number.isInteger(i) || i < 0 || i > 3) {
      throw new Error(`${prefix} correct_indices-Wert ungültig: ${i}`);
    }
  }
  if (!VALID_DIFFS.includes(q.difficulty)) {
    throw new Error(`${prefix} difficulty ungültig: ${q.difficulty}`);
  }
}

async function listQuestionFiles(dir) {
  const entries = await readdir(dir);
  const out = [];
  for (const e of entries) {
    if (!e.endsWith('.questions.json')) continue;
    const full = join(dir, e);
    const s = await stat(full);
    if (s.isFile()) out.push(full);
  }
  return out.sort();
}

async function processFile(filePath, dryRun) {
  const doc = JSON.parse(await readFile(filePath, 'utf8'));
  validateFile(doc);
  doc.questions.forEach(validateQuestion);
  console.log(`\n📦 ${basename(filePath)} — ${doc.questions.length} Fragen · ${doc.exam_part}/${doc.exam_season}/${doc.exam_year}`);

  if (dryRun) {
    console.log('   (dry-run: nichts geschrieben)');
    return { inserted: 0, failed: 0, total: doc.questions.length };
  }

  let inserted = 0, failed = 0;
  for (let i = 0; i < doc.questions.length; i++) {
    const q = doc.questions[i];
    try {
      await upsertQuestion(
        {
          topic: q.topic,
          subtopic: q.subtopic || null,
          question: q.question,
          options: q.options,
          correct_indices: q.correct_indices,
          hint: q.hint || null,
          solution: q.solution,
          difficulty: q.difficulty,
          has_diagram: Boolean(q.has_diagram),
        },
        {
          exam_part: doc.exam_part,
          exam_year: doc.exam_year,
          exam_season: doc.exam_season,
          source_pdf: doc.source_pdf,
          source_page: q.source_page || null,
          diagram_url: q.diagram_url || null,
        },
      );
      inserted += 1;
      process.stdout.write(`\r   ${inserted}/${doc.questions.length} upserted  `);
    } catch (err) {
      failed += 1;
      console.error(`\n   ❌ Frage ${i + 1}: ${err.message}`);
    }
  }
  console.log(`\n   ✅ ${inserted} geschrieben, ${failed} Fehler`);
  return { inserted, failed, total: doc.questions.length };
}

async function main() {
  const dryRun = Boolean(values['dry-run']);

  let files;
  if (values.dir) {
    const dir = resolve(values.dir);
    files = await listQuestionFiles(dir);
    if (files.length === 0) {
      console.error(`Keine *.questions.json in ${dir} gefunden.`);
      process.exit(1);
    }
    console.log(`📁 ${files.length} Fragen-Dateien in ${dir}`);
  } else {
    files = [resolve(values.file)];
  }

  const totals = { inserted: 0, failed: 0, total: 0, filesOk: 0, filesErr: 0 };
  for (const f of files) {
    try {
      const r = await processFile(f, dryRun);
      totals.inserted += r.inserted;
      totals.failed   += r.failed;
      totals.total    += r.total;
      totals.filesOk  += 1;
    } catch (err) {
      totals.filesErr += 1;
      console.error(`\n❌ ${basename(f)}: ${err.message}`);
    }
  }

  console.log(`\n\n✨ Fertig: ${totals.inserted}/${totals.total} Fragen aus ${totals.filesOk} Dateien geschrieben${totals.filesErr ? ` · ${totals.filesErr} Dateien fehlerhaft` : ''}${dryRun ? ' (dry-run)' : ''}`);
}

main().catch(err => {
  console.error('Fehler:', err);
  process.exit(1);
});
