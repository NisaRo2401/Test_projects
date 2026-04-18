#!/usr/bin/env node
// Stufe 2 (neu): Lokale OCR aller gerenderten PNG-Seiten → Text-JSONs.
// Damit Claude Code später nur noch leichten Text verarbeiten muss (statt Bilder).
//
// Usage:
//   node ocr-extract.mjs --dir ./output/            # alle *.extracted.json im Ordner
//   node ocr-extract.mjs --file ./output/X.extracted.json
//   node ocr-extract.mjs --dir ./output/ --workers 4
//
// Voraussetzung: extract-pdf.mjs lief vorher und hat die PNGs + extracted.json erzeugt.
// Das Tesseract-Sprachmodell 'deu' wird beim ersten Aufruf automatisch nachgeladen (~15 MB, gecacht).

import { parseArgs } from 'node:util';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorker } from 'tesseract.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const { values } = parseArgs({
  options: {
    dir:      { type: 'string' },
    file:     { type: 'string' },
    workers:  { type: 'string', default: '2' },
    lang:     { type: 'string', default: 'deu' },
    force:    { type: 'boolean', default: false },
    help:     { type: 'boolean', default: false, short: 'h' },
  },
});

if (values.help || (!values.dir && !values.file)) {
  console.error(`
Usage:
  node ocr-extract.mjs --dir ./output/
  node ocr-extract.mjs --file ./output/X.extracted.json

Optional:
  --workers <n>   Parallele Tesseract-Worker (Default 2, viel CPU nötig)
  --lang <code>   Sprachmodell (Default 'deu', z.B. 'deu+eng')
  --force         Überschreibt existierende *.ocr.json (sonst wird übersprungen)
`);
  process.exit(values.help ? 0 : 1);
}

const WORKERS = Math.max(1, Number(values.workers) || 1);
const LANG = values.lang;
const DIAGRAM_TEXT_THRESHOLD = 150; // Seiten mit < 150 Zeichen OCR-Text gelten als Diagramm/Skizze

async function listExtractedJsons(dir) {
  const entries = await readdir(dir);
  return entries
    .filter(e => e.endsWith('.extracted.json'))
    .map(e => join(dir, e))
    .sort();
}

function stripNoise(text) {
  return text
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function ocrPages(pages, outDir, pool) {
  const results = [];
  let inFlight = 0;
  let i = 0;
  const total = pages.length;

  return new Promise((resolveAll, reject) => {
    const next = () => {
      if (i >= total && inFlight === 0) {
        resolveAll(results);
        return;
      }
      while (inFlight < pool.length && i < total) {
        const idx = i++;
        const page = pages[idx];
        const worker = pool[inFlight];
        inFlight += 1;
        const pngAbs = join(outDir, page.png);
        worker.recognize(pngAbs)
          .then(({ data }) => {
            const text = stripNoise(data.text || '');
            results[idx] = {
              role: page.role,
              page: page.page,
              png: page.png,
              text,
              likely_diagram: text.length < DIAGRAM_TEXT_THRESHOLD,
              confidence: Math.round(data.confidence || 0),
            };
            process.stdout.write(`\r   OCR ${results.filter(Boolean).length}/${total}  `);
          })
          .catch(err => { results[idx] = { ...page, error: err.message }; })
          .finally(() => {
            inFlight -= 1;
            next();
          });
      }
    };
    next();
  });
}

async function processOne(jsonPath, poolFactory) {
  const doc = JSON.parse(await readFile(jsonPath, 'utf8'));
  const outDir = dirname(jsonPath);
  const ocrPath = jsonPath.replace(/\.extracted\.json$/, '.ocr.json');

  if (!values.force) {
    try {
      await readFile(ocrPath, 'utf8');
      console.log(`   ↷ ${basename(ocrPath)} existiert bereits (mit --force überschreiben).`);
      return { skipped: true, ocrPath };
    } catch { /* nicht vorhanden, weiter */ }
  }

  console.log(`\n📄 ${basename(jsonPath)} — ${doc.pages.length} Seiten`);
  const pool = await poolFactory();
  try {
    const pagesOcr = await ocrPages(doc.pages, outDir, pool);
    const out = {
      source_pdf: doc.source_pdf,
      solution_pdf: doc.solution_pdf,
      page_dir: doc.page_dir,
      exam_part: doc.exam_part,
      exam_year: doc.exam_year,
      exam_season: doc.exam_season,
      meta_source: doc.meta_source,
      ocr_at: new Date().toISOString(),
      ocr_lang: LANG,
      pages: pagesOcr,
    };
    await writeFile(ocrPath, JSON.stringify(out, null, 2), 'utf8');
    const diagrams = pagesOcr.filter(p => p.likely_diagram).length;
    const avgConf = Math.round(pagesOcr.reduce((a, p) => a + (p.confidence || 0), 0) / pagesOcr.length);
    console.log(`\n   ✅ ${basename(ocrPath)} · ø ${avgConf}% Konfidenz · ${diagrams} Seiten mit vermutlich Diagramm`);
    return { ocrPath, diagrams, avgConf, pages: pagesOcr.length };
  } finally {
    for (const w of pool) await w.terminate();
  }
}

async function makePool() {
  process.stdout.write(`   Lade Tesseract-Sprachmodell '${LANG}' (${WORKERS} Worker)…`);
  const workers = [];
  for (let i = 0; i < WORKERS; i++) {
    workers.push(await createWorker(LANG));
  }
  process.stdout.write(` bereit\n`);
  return workers;
}

async function main() {
  let files;
  if (values.dir) {
    const dir = resolve(values.dir);
    files = await listExtractedJsons(dir);
    if (files.length === 0) {
      console.error(`Keine *.extracted.json in ${dir} gefunden.`);
      process.exit(1);
    }
    console.log(`📁 ${files.length} extrahierte PDFs in ${dir}`);
  } else {
    files = [resolve(values.file)];
  }

  const results = [];
  for (const f of files) {
    try {
      results.push(await processOne(f, makePool));
    } catch (err) {
      console.error(`\n   ❌ ${basename(f)}: ${err.message}`);
      results.push({ file: f, error: err.message });
    }
  }

  const done = results.filter(r => r.ocrPath && !r.skipped).length;
  const skipped = results.filter(r => r.skipped).length;
  const errored = results.filter(r => r.error).length;
  console.log(`\n✨ Fertig — ${done} OCR-Dateien geschrieben${skipped ? `, ${skipped} übersprungen` : ''}${errored ? `, ${errored} Fehler` : ''}.`);
  console.log(`\nNächster Schritt: Claude Code bitten, alle *.ocr.json zu lesen und daraus`);
  console.log(`<name>.questions.json gemäß tools/prompts/system.md zu erzeugen.`);
}

main().catch(err => {
  console.error('Fehler:', err);
  process.exit(1);
});
