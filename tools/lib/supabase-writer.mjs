// Schreibt Fragen nach Supabase, idempotent über source_hash.
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';

let _client = null;
function client() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt in .env');
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

function sha256(parts) {
  const h = createHash('sha256');
  for (const p of parts) h.update(String(p));
  return h.digest('hex').slice(0, 24);
}

/**
 * Lädt ein Bild in den Storage-Bucket und gibt die public URL zurück.
 */
export async function uploadDiagram(localPath, examPart, year, season, page) {
  const ext = extname(localPath) || '.png';
  const objectPath = `${examPart}-${year}-${season}/page-${page}${ext}`;
  const buf = await readFile(localPath);
  const { error } = await client()
    .storage
    .from('ihk-diagrams')
    .upload(objectPath, buf, { contentType: 'image/png', upsert: true });
  if (error) throw new Error(`Storage-Upload fehlgeschlagen: ${error.message}`);
  const { data } = client().storage.from('ihk-diagrams').getPublicUrl(objectPath);
  return data.publicUrl;
}

/**
 * Upsert einer Frage. Gibt zurück: { inserted: boolean, id: uuid }
 */
export async function upsertQuestion(q, meta) {
  const hash = sha256([
    meta.source_pdf, meta.source_page, q.question, q.options.join('|')
  ]);
  const row = {
    exam_part: meta.exam_part,
    exam_year: meta.exam_year,
    exam_season: meta.exam_season,
    topic: q.topic,
    subtopic: q.subtopic,
    question: q.question,
    options: q.options,
    correct_indices: q.correct_indices,
    hint: q.hint,
    solution: q.solution,
    difficulty: q.difficulty,
    has_diagram: q.has_diagram,
    diagram_url: meta.diagram_url || null,
    source_pdf: basename(meta.source_pdf),
    source_page: meta.source_page,
    source_hash: hash,
  };
  const { data, error } = await client()
    .from('questions')
    .upsert(row, { onConflict: 'source_hash' })
    .select('id')
    .single();
  if (error) throw new Error(`Upsert fehlgeschlagen: ${error.message}`);
  return { id: data.id, hash };
}
