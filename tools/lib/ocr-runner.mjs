import { join } from 'node:path';

export function stripOcrNoise(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function ocrPages(
  pages,
  outDir,
  pool,
  { diagramTextThreshold = 150, onProgress = () => {} } = {},
) {
  if (!Array.isArray(pages)) throw new TypeError('pages muss ein Array sein');
  if (!Array.isArray(pool) || pool.length === 0) throw new TypeError('pool darf nicht leer sein');

  const results = new Array(pages.length);
  let nextPageIndex = 0;
  let completed = 0;

  async function runWorker(worker) {
    while (nextPageIndex < pages.length) {
      const idx = nextPageIndex++;
      const page = pages[idx];
      const pngAbs = join(outDir, page.png);
      try {
        const { data } = await worker.recognize(pngAbs);
        const text = stripOcrNoise(data.text);
        results[idx] = {
          role: page.role,
          page: page.page,
          png: page.png,
          text,
          likely_diagram: text.length < diagramTextThreshold,
          confidence: Math.round(data.confidence || 0),
        };
      } catch (error) {
        results[idx] = { ...page, error: error.message || String(error) };
      }
      completed += 1;
      onProgress(completed, pages.length);
    }
  }

  await Promise.all(pool.map(runWorker));
  return results;
}
