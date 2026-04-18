# IHK Exam PDF-Import (kostenfrei, Token-schonend, Batch-Modus)

Pipeline: **PDFs → PNG-Seiten → lokale OCR → Claude Code liest Text → questions.json → Supabase**.

Da IHK-Prüfungs-PDFs meist **gescannt** sind (nur Bilder, kein Text-Layer), rendert das Tool jede Seite als PNG und lässt dann **lokal Tesseract.js** (deu) darüberlaufen. Claude Code bekommt anschließend nur noch leichte Text-JSONs — damit bleiben die Tokens im Budget. Bei echten Diagramm-Aufgaben kann Claude Code das zugehörige PNG bei Bedarf zusätzlich lesen.

## Setup (einmalig)

```bash
cd Test_projects/tools
npm install
cp .env.example .env
# .env füllen mit SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
```

Dazu:
1. Im Supabase-SQL-Editor `docs/ihk-exam-schema.sql` ausführen.
2. Storage-Bucket `ihk-diagrams` (public) manuell im Supabase-Dashboard anlegen.

## Dateinamen-Konvention (für Auto-Meta)

Der Parser erkennt folgende Muster im PDF-Namen:

| Beispiel-Dateiname | erkannt |
|---|---|
| `AP1-Winter-2023.pdf` | AP1 · Winter · 2023 |
| `AP2_GA1_Sommer_2022.pdf` | GA1 · Sommer · 2022 |
| `FiAE AP2 GA2 Winter 2024.pdf` | GA2 · Winter · 2024 |
| `WiSo_W23.pdf` | WiSo · Winter · 2023 |
| `AP S2012 IT GA1 FIAE.pdf` | GA1 · Sommer · 2012 |
| `ap_it_sommer2009_ga1_fiae.pdf` | GA1 · Sommer · 2009 |
| `AP2_T1_FIAE_S2025.pdf` | GA1 · Sommer · 2025 (T1 → GA1) |
| `… Löser.pdf` / `… Lösung.pdf` / `loesungen_…pdf` | Lösungs-PDF (wird gepaart) |

Nicht eindeutig? Per CLI-Flag setzen (`--part`, `--year`, `--season`), oder in der erzeugten `extracted.json` nachträglich ergänzen. Claude Code kann die Meta im nächsten Schritt auch aus dem Deckblatt der Prüfung ablesen.

## Batch-Workflow (kompletter Ordner)

### 1. Alle PDFs als PNGs rendern

```bash
# PDFs nach ./input-pdfs/ legen (gitignored), dann:
node extract-pdf.mjs --dir ./input-pdfs/
# → ./output/<name>/page-01.png, page-02.png, …  (Seiten als PNG)
# → ./output/<name>.extracted.json                (Meta + Liste der PNGs)
# → ./output/_index.json                          (Zusammenfassung aller Läufe)
```

Aufgaben- und Lösungs-PDFs werden automatisch gepaart; Lösungsseiten landen unter `output/<name>/solution/`.

Skalierung per `--scale <n>` anpassen (Default `1.5` ≈ 1500 px Breite, gut lesbar bei moderater Dateigröße; `--scale 2` für hochauflösende Diagramme).

### 2. OCR lokal über alle PNGs laufen lassen

```bash
node ocr-extract.mjs --dir ./output/
# → ./output/<name>.ocr.json  (Text pro Seite + Konfidenz + likely_diagram)
```

Tesseract.js lädt beim ersten Lauf das Sprachmodell `deu` (~15 MB, gecacht) und erkennt den Text lokal. Einstellbar:

- `--workers <n>` parallele Worker (Default 2, kostet CPU)
- `--lang <code>` z.B. `deu+eng`
- `--force` überschreibt bestehende `*.ocr.json`

Seiten mit sehr wenig Text (< 150 Zeichen) werden als `likely_diagram: true` markiert — diese Seiten können später gezielt zusätzlich als PNG gelesen werden, wenn die zugehörige Aufgabe ein Diagramm verlangt.

### 3. Claude Code generiert MC-Fragen (textbasiert)

Öffne Claude Code und bitte:

> "Bitte verarbeite alle `tools/output/*.ocr.json`-Dateien nach den Regeln in `tools/prompts/system.md`. Pro Eingabe schreibst du eine `<name>.questions.json` gemäß `tools/prompts/output-format.md`. Bei Diagramm-Aufgaben (has_diagram) darfst du das zugehörige PNG zusätzlich anschauen."

Claude Code liest nur noch Text → **deutlich weniger Tokens** als beim rein multimodalen Verfahren.

### 4. Alle Fragen nach Supabase importieren

```bash
node insert-questions.mjs --dir ./output/
# optional vorher:
node insert-questions.mjs --dir ./output/ --dry-run
```

**Idempotent** (über `source_hash` = sha256 aus PDF-Name + Seite + Fragetext + Optionen). Mehrfaches Ausführen überschreibt statt zu duplizieren — der ganze Ordner lässt sich beliebig oft erneut importieren.

## Alternativer Einzel-Modus

```bash
node extract-pdf.mjs --pdf ./input-pdfs/AP2-GA1-Sommer-2023.pdf
# → output/AP2-GA1-Sommer-2023/ + .extracted.json

node ocr-extract.mjs --file ./output/AP2-GA1-Sommer-2023.extracted.json
# → output/AP2-GA1-Sommer-2023.ocr.json

# Claude Code um Generierung bitten, dann:
node insert-questions.mjs --file ./output/AP2-GA1-Sommer-2023.questions.json
```

## Dateien im Überblick

```
tools/
├── extract-pdf.mjs          # Stufe 1: PDF(s) → PNGs + extracted.json
├── ocr-extract.mjs          # Stufe 2: PNGs → ocr.json (Tesseract.js, lokal)
├── insert-questions.mjs     # Stufe 4: questions.json(s) → Supabase
├── lib/
│   ├── pdf-extract.mjs      # pdfjs-dist + @napi-rs/canvas → PNG pro Seite
│   ├── filename-parser.mjs  # Meta aus PDF-Dateiname raten + Pairing-Key
│   └── supabase-writer.mjs  # Idempotenter Upsert
├── prompts/
│   ├── system.md            # Regeln für Claude Code (textbasiert, OCR)
│   └── output-format.md     # Ziel-JSON-Schema
├── input-pdfs/              # (gitignored) PDFs hier ablegen
└── output/                  # (gitignored) PNGs + extracted + ocr + questions JSONs
```

## Prüfungsteile / Saisons

`exam_part` ∈ `AP1`, `GA1`, `GA2`, `WiSo` · `exam_season` ∈ `Sommer`, `Winter`.
