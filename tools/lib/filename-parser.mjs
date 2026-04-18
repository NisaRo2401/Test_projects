// Erkennt aus einem PDF-Dateinamen die Prüfungs-Meta:
// exam_part (AP1/GA1/GA2/WiSo), exam_year (4-stellig), exam_season (Sommer/Winter),
// und ob es sich um eine Lösungs-PDF handelt (isSolution).
//
// Beispiele, die erkannt werden:
//   "AP1-Winter-2023.pdf"                        → AP1 / 2023 / Winter
//   "AP2_GA1_Sommer_2022.pdf"                    → GA1 / 2022 / Sommer
//   "FiAE AP2 GA2 Winter 2024.pdf"               → GA2 / 2024 / Winter
//   "WiSo_W23.pdf"                               → WiSo / 2023 / Winter
//   "Pruefung-S24-GA1.pdf"                       → GA1 / 2024 / Sommer
//   "ap_it_sommer2009_ga1_fiae.pdf"              → GA1 / 2009 / Sommer
//   "FI-AE_Abschlusspruefung_GA1_Sommer2008.pdf" → GA1 / 2008 / Sommer
//   "AP S2012 IT GA1 FIAE.pdf"                   → GA1 / 2012 / Sommer
//   "AP2_T1_FIAE_S2025.pdf"                      → GA1 / 2025 / Sommer  (T1 → GA1 im AP2)
//   "GA_1_FiAe.pdf"                              → GA1 (Jahr unbekannt)
//   "Lösung_GA_2_Fi_beide.pdf"                   → GA2, isSolution=true

const PART_RE    = /\b(AP1|GA\s*[-_]?\s*1|GA\s*[-_]?\s*2|WISO|WiSo|Wiso)\b/i;
const SEASON_LONG_RE = /(Sommer|Winter)/i;            // auch wenn Jahr direkt angeklebt
const SEASON_SHORT_RE = /(?:^|[^a-z])([SW])\s*-?\s*(\d{2,4})(?![a-z])/i;  // S24, W-2023, S2025
const YEAR_LONG_RE = /(?<![0-9])(20\d{2})(?![0-9])/;
const YEAR_SHORT_RE = /\b'?(\d{2})\b/;

// Lösungs-PDF erkennen
const SOLUTION_RE = /(l[öo]es?u?ng|l[öo]ser|loeser|solution|musterl[öo]sung)/i;

// T1/T2-Heuristik innerhalb AP2: T1 → GA1 (Entwicklung), T2 → GA2 (Planung)
const AP2_T_RE = /\bAP\s*2?\s*[-_\s]?\s*T(?:eil)?[-_\s]?\s*([12])\b/i;

export function parseFilename(basename) {
  const clean = basename.replace(/\.pdf$/i, '');
  const out = {
    exam_part: null,
    exam_year: null,
    exam_season: null,
    isSolution: SOLUTION_RE.test(clean),
  };

  // Prüfungsteil
  const partMatch = clean.match(PART_RE);
  if (partMatch) {
    const raw = partMatch[1].toUpperCase().replace(/[\s_-]/g, '');
    if (raw === 'WISO') out.exam_part = 'WiSo';
    else if (raw === 'AP1') out.exam_part = 'AP1';
    else if (raw === 'GA1') out.exam_part = 'GA1';
    else if (raw === 'GA2') out.exam_part = 'GA2';
  }

  // AP2-T1/T2-Fallback, wenn kein direktes GA1/GA2 erkannt
  if (!out.exam_part) {
    const t = clean.match(AP2_T_RE);
    if (t) out.exam_part = t[1] === '1' ? 'GA1' : 'GA2';
  }

  // Saison (lang)
  const seasonLong = clean.match(SEASON_LONG_RE);
  if (seasonLong) {
    out.exam_season = seasonLong[1].charAt(0).toUpperCase() + seasonLong[1].slice(1).toLowerCase();
  }

  // Jahr (4-stellig)
  const yearLong = clean.match(YEAR_LONG_RE);
  if (yearLong) out.exam_year = Number(yearLong[1]);

  // Kurzform S24 / W-2023 / S2025 — füllt Saison und/oder Jahr auf
  if (!out.exam_season || !out.exam_year) {
    const short = clean.match(SEASON_SHORT_RE);
    if (short) {
      if (!out.exam_season) {
        out.exam_season = short[1].toUpperCase() === 'S' ? 'Sommer' : 'Winter';
      }
      if (!out.exam_year) {
        const n = Number(short[2]);
        out.exam_year = n < 100 ? 2000 + n : n;
      }
    }
  }

  // Fallback: 2-stellige Jahreszahl
  if (!out.exam_year) {
    const yearShort = clean.match(YEAR_SHORT_RE);
    if (yearShort) {
      const n = Number(yearShort[1]);
      if (n >= 0 && n <= 99) out.exam_year = 2000 + n;
    }
  }

  return out;
}

export function describeMeta(meta) {
  return [
    meta.exam_part || '??',
    meta.exam_season || '??',
    meta.exam_year || '????',
  ].join(' · ') + (meta.isSolution ? ' · [Lösung]' : '');
}

export function isComplete(meta) {
  return (
    ['AP1', 'GA1', 'GA2', 'WiSo'].includes(meta.exam_part) &&
    ['Sommer', 'Winter'].includes(meta.exam_season) &&
    Number.isInteger(meta.exam_year) &&
    meta.exam_year >= 2000 && meta.exam_year <= 2100
  );
}

// Normalisiert einen Dateinamen für Paarungs-Vergleich:
// entfernt Lösungs-Marker und Whitespace, damit Aufgabe+Lösung denselben Key ergeben.
export function pairingKey(basename) {
  const clean = basename
    .replace(/\.pdf$/i, '')
    .toLowerCase()
    .replace(SOLUTION_RE, '')
    .replace(/[\s_\-.]+/g, '');
  return clean;
}
