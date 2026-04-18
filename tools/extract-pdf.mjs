#!/usr/bin/env node
// Stufe 1: PDF(s) → PNGs pro Seite + Meta-JSON.
// IHK-Prüfungen sind meist gescannte PDFs (nur Bilder, kein Text). Diese Pipeline
// rendert jede Seite als PNG, damit Claude Code sie anschließend multimodal liest
// und daraus MC-Fragen generiert.
//
// Usage:
//   node extract-pdf.mjs --pdf ./input-pdfs/X.pdf
//   node extract-pdf.mjs --dir ./input-pdfs/
//   node extract-pdf.mjs --dir ./input-pdfs/ --out ./output/ --scale 2
//
// Aufgaben- und Lösungs-PDFs (z.B. "X.pdf" + "X Löser.pdf") werden automatisch
// gepaart und in denselben Output-Ordner gerendert.

import { parseArgs } from 'node:util';
import { writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve, basename, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractPdf } from './lib/pdf-extract.mjs';
import { parseFilename, describeMeta, isComplete, pairingKey } from './lib/filename-parser.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const { values } = parseArgs({
  options: {
    pdf:    { type: 'string' },
    dir:    { type: 'string' },
    out:    { type: 'string' },
    part:   { type: 'string' },
    year:   { type: 'string' },
    season: { type: 'string' },
    scale:  { type: 'string', default: '1.5' },
    help:   { type: 'boolean', default: false, short: 'h' },
  },
});

if (values.help || (!values.pdf && !values.dir)) {
  console.error(`
Usage:
  node extract-pdf.mjs --pdf <file.pdf>
  node extract-pdf.mjs --dir <folder>
  node extract-pdf.mjs --dir <folder> --out <dir> --scale 2

Optional:
  --part <AP1|GA1|GA2|WiSo>   Meta-Override (sonst aus Dateinamen)
  --year <YYYY>
  --season <Sommer|Winter>
  --scale <Zahl>              PNG-Render-Skalierung (Default 1.5 ≈ 1500 px Breite)
`);
  process.exit(values.help ? 0 : 1);
}

const SCALE = Number(values.scale) || 1.5;

async function listPdfs(dir) {
  const entries = await readdir(dir);
  const pdfs = [];
  for (const e of entries) {
    const full = join(dir, e);
    const s = await stat(full);
    if (s.isFile() && extname(e).toLowerCase() === '.pdf') pdfs.push(full);
  }
  return pdfs.sort();
}

// Paart Aufgaben- und Lösungs-PDFs anhand von pairingKey.
function buildPairs(pdfPaths) {
  const byKey = new Map();
  for (const p of pdfPaths) {
    const fname = basename(p);
    const meta = parseFilename(fname);
    const key = pairingKey(fname);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push({ path: p, fname, meta });
  }

  const pairs = [];
  for (const [, items] of byKey) {
    const tasks = items.filter(i => !i.meta.isSolution);
    const sols  = items.filter(i =>  i.meta.isSolution);

    if (tasks.length === 0 && sols.length > 0) {
      for (const s of sols) pairs.push({ taskPdf: s, solutionPdf: null, meta: s.meta });
    } else if (tasks.length === 1) {
      pairs.push({ taskPdf: tasks[0], solutionPdf: sols[0] || null, meta: tasks[0].meta });
    } else {
      for (let i = 0; i < tasks.length; i++) {
        pairs.push({
          taskPdf: tasks[i],
          solutionPdf: sols[i] || null,
          meta: tasks[i].meta,
        });
      }
      for (let i = tasks.length; i < sols.length; i++) {
        pairs.push({ taskPdf: sols[i], solutionPdf: null, meta: sols[i].meta });
      }
    }
  }
  return pairs.sort((a, b) => a.taskPdf.fname.localeCompare(b.taskPdf.fname));
}

function safeName(fname) {
  // Dateinamen mit Leerzeichen/Umlauten für Ordnernamen entschärfen
  return basename(fname, extname(fname))
    .normalize('NFKD')
    .replace(/[^\w-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

async function extractOne(pair, outDir) {
  const { taskPdf, solutionPdf, meta: rawMeta } = pair;
  const fname = taskPdf.fname;

  const meta = {
    exam_part:   values.part   || rawMeta.exam_part,
    exam_year:   values.year   ? Number(values.year) : rawMeta.exam_year,
    exam_season: values.season || rawMeta.exam_season,
  };

  const metaComplete = isComplete(meta);
  const stem = safeName(fname);
  console.log(`\n📄 ${fname}`);
  console.log(`   Meta: ${describeMeta({ ...meta, isSolution: rawMeta.isSolution })}${metaComplete ? '' : '  ⚠️ unvollständig'}`);
  if (solutionPdf) console.log(`   ↳ Lösungs-PDF: ${solutionPdf.fname}`);

  const pageDir = join(outDir, stem);
  await mkdir(pageDir, { recursive: true });

  // Aufgaben-Seiten rendern
  process.stdout.write(`   Rendere Aufgaben-Seiten…`);
  const taskRender = await extractPdf(taskPdf.path, pageDir, SCALE);
  let allPages = taskRender.pages.map(p => ({
    role: 'task',
    page: p.page,
    png: relative(outDir, p.pngPath).replace(/\\/g, '/'),
    text: p.text || '',
  }));
  process.stdout.write(` ${taskRender.numPages} Seiten\n`);

  // Lösungs-Seiten rendern (falls Pair)
  if (solutionPdf) {
    const solDir = join(pageDir, 'solution');
    await mkdir(solDir, { recursive: true });
    process.stdout.write(`   Rendere Lösungs-Seiten…`);
    const solRender = await extractPdf(solutionPdf.path, solDir, SCALE);
    const solPages = solRender.pages.map(p => ({
      role: 'solution',
      page: p.page,
      png: relative(outDir, p.pngPath).replace(/\\/g, '/'),
      text: p.text || '',
    }));
    allPages = allPages.concat(solPages);
    process.stdout.write(` ${solRender.numPages} Seiten\n`);
  }

  const hasText = allPages.some(p => p.text.length > 20);

  const jsonPath = join(outDir, `${stem}.extracted.json`);
  const out = {
    source_pdf: fname,
    solution_pdf: solutionPdf ? solutionPdf.fname : null,
    page_dir: relative(outDir, pageDir).replace(/\\/g, '/'),
    exam_part:   meta.exam_part   || null,
    exam_year:   meta.exam_year   || null,
    exam_season: meta.exam_season || null,
    meta_source: metaComplete ? 'filename' : 'filename-partial',
    extracted_at: new Date().toISOString(),
    scale: SCALE,
    has_text_layer: hasText,
    pages: allPages,
  };
  await writeFile(jsonPath, JSON.stringify(out, null, 2), 'utf8');
  console.log(`   ✅ ${jsonPath} (${allPages.length} PNGs${hasText ? ', + Text-Layer' : ', nur Scans'})`);
  return {
    pdf: fname,
    pairedWith: solutionPdf?.fname || null,
    pages: allPages.length,
    hasText,
    metaComplete,
    jsonPath,
  };
}

async function main() {
  const outDir = values.out ? resolve(values.out) : join(__dirname, 'output');
  await mkdir(outDir, { recursive: true });

  let pairs;
  if (values.dir) {
    const dir = resolve(values.dir);
    const files = await listPdfs(dir);
    if (files.length === 0) {
      console.error(`Keine PDFs gefunden in ${dir}`);
      process.exit(1);
    }
    pairs = buildPairs(files);
    const paired = pairs.filter(p => p.solutionPdf).length;
    console.log(`📁 ${files.length} PDFs in ${dir} → ${pairs.length} Einträge (${paired} gepaart) · Scale ${SCALE}`);
  } else {
    const p = resolve(values.pdf);
    const fname = basename(p);
    pairs = [{ taskPdf: { path: p, fname }, solutionPdf: null, meta: parseFilename(fname) }];
  }

  const results = [];
  for (const pair of pairs) {
    try {
      results.push(await extractOne(pair, outDir));
    } catch (err) {
      console.error(`   ❌ ${pair.taskPdf.fname}: ${err.message}`);
      results.push({ pdf: pair.taskPdf.fname, error: err.message });
    }
  }

  const indexPath = join(outDir, '_index.json');
  await writeFile(indexPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    count: results.length,
    scale: SCALE,
    files: results,
  }, null, 2), 'utf8');

  console.log(`\n📇 Index: ${indexPath}`);
  const incomplete = results.filter(r => r.metaComplete === false);
  if (incomplete.length) {
    console.log(`\n⚠️  ${incomplete.length} Einträge mit unvollständiger Meta (siehe _index.json).`);
    console.log(`   → Benenne die PDF um (z.B. "AP2-GA1-Sommer-2023.pdf") oder korrigiere die Meta im extracted.json.`);
  }
  console.log(`\n✨ Fertig — ${results.length} Einträge gerendert.`);
  console.log(`\nNächster Schritt: Claude Code bitten, die PNGs aller extracted.json multimodal zu lesen`);
  console.log(`und daraus <name>.questions.json gemäß tools/prompts/system.md zu erzeugen. Dann:`);
  console.log(`  node insert-questions.mjs --dir ${outDir}`);
}

main().catch(err => {
  console.error('Fehler:', err);
  process.exit(1);
});
