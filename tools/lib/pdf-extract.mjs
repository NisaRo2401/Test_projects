// PDF → PNG pro Seite (für gescannte IHK-PDFs mit multimodaler Claude-Code-Verarbeitung).
// Text-Extraktion bleibt als Bonus erhalten, falls ein PDF doch einen Text-Layer hat.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createCanvas } from '@napi-rs/canvas';

const require = createRequire(import.meta.url);
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

// Worker-Setup — unter Windows muss der Pfad als file:// URL vorliegen.
const pdfjsWorkerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(pdfjsWorkerPath).href;

// CanvasFactory für Node (pdfjs-dist erwartet dieses Interface beim Rendern).
class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height);
    return { canvas, context: canvas.getContext('2d') };
  }
  reset(cc, width, height) {
    cc.canvas.width = width;
    cc.canvas.height = height;
  }
  destroy(cc) {
    cc.canvas.width = 0;
    cc.canvas.height = 0;
    cc.canvas = null;
    cc.context = null;
  }
}

/**
 * Rendert jede Seite als PNG und versucht nebenbei Textextraktion.
 * @param {string} pdfPath
 * @param {string} pageOutDir  Ordner, in den die PNGs geschrieben werden
 * @param {number} scale       Render-Skalierung (1.5 = gute Lesbarkeit, ~2 MB pro Seite)
 * @returns {Promise<{pages: Array<{page:number, pngPath:string, text:string}>, numPages:number}>}
 */
export async function extractPdf(pdfPath, pageOutDir, scale = 1.5) {
  const data = new Uint8Array(await readFile(pdfPath));
  const canvasFactory = new NodeCanvasFactory();
  const doc = await pdfjs.getDocument({
    data,
    disableFontFace: true,
    canvasFactory,
    verbosity: 0,
  }).promise;

  await mkdir(pageOutDir, { recursive: true });
  const pages = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);

    // Text-Layer (falls vorhanden) als Bonus
    const content = await page.getTextContent();
    const text = content.items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim();

    // PNG rendern
    const viewport = page.getViewport({ scale });
    const cc = canvasFactory.create(viewport.width, viewport.height);
    await page.render({
      canvasContext: cc.context,
      viewport,
      canvasFactory,
    }).promise;

    const pageNum = String(p).padStart(2, '0');
    const pngPath = join(pageOutDir, `page-${pageNum}.png`);
    const buf = cc.canvas.toBuffer('image/png');
    await writeFile(pngPath, buf);
    canvasFactory.destroy(cc);

    pages.push({ page: p, pngPath, text });
    page.cleanup();
  }

  await doc.destroy();
  return { pages, numPages: doc.numPages };
}
