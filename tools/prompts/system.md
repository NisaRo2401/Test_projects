# Anleitung für Claude Code — IHK-Fragen aus OCR-Texten generieren

**Kontext:** Du bekommst `*.ocr.json`-Dateien (erzeugt von `ocr-extract.mjs`). Jede Datei enthält den lokal OCR-erfassten Text aller PDF-Seiten einer IHK-Prüfung inkl. Meta (`exam_part`, `exam_year`, `exam_season`). **Du arbeitest nur mit Text** — die zugehörigen PNGs liegen zwar daneben, müssen aber normalerweise nicht gelesen werden (spart Tokens).

**Deine Aufgabe:** Daraus hochwertige Multiple-Choice-Lernfragen generieren und als `<name>.questions.json` speichern, gemäß `output-format.md`.

Ziel ist **maximaler Lerneffekt** für die IHK-Abschlussprüfung Fachinformatiker Anwendungsentwicklung.

---

## Workflow (Batch-Modus)

1. Liste alle `tools/output/*.ocr.json`-Dateien auf.
2. Für **jede** Datei:
   - Lies die Meta und den `pages[]`-Array.
   - OCR-Text kann Rauschen enthalten (Pipes/Querstriche, verschluckte Umlaute, falsche Zeichen). **Rekonstruiere sinngemäß** — verlasse dich auf den IHK-Kontext.
   - Identifiziere die einzelnen Handlungsschritte (Regex-Muster: `\d+\.\s*Handlungsschritt`, manchmal auch `Aufgabe \d+`) und die zugehörigen Musterlösungen (Seiten mit `role: "solution"`).
   - Falls `exam_part`/`year`/`season` `null` sind: versuche sie aus `pages[0].text` (Deckblatt) zu rekonstruieren. Gelingt das nicht, überspringe die Datei und logge.
   - Pro Handlungsschritt → **2–6 MC-Fragen** (siehe Regeln unten).
   - Bei Aufgaben, die sich auf ein **Diagramm** beziehen (Seiten mit `likely_diagram: true` oder Aufgabentexte wie „Erstellen Sie ein UML-Zustandsdiagramm"): setze `has_diagram: true` und `source_page` auf die Aufgabenseite. **Dann darfst du das zugehörige PNG zusätzlich lesen** (`tools/output/<page_dir>/page-XX.png`), um Diagramm-Details korrekt zu treffen. Nur bei Bedarf — nicht bei jeder Frage.
   - Schreibe das Ergebnis nach `tools/output/<gleicher-basisname>.questions.json` gemäß `output-format.md`.
3. Nach allen Dateien: der Nutzer führt einmal aus:
   ```bash
   node insert-questions.mjs --dir ./output/
   ```

**Einzeldatei-Modus:** Wenn der Nutzer eine bestimmte `ocr.json` nennt, verarbeite nur diese.

---

## Umgang mit OCR-Fehlern

Typische Muster, die du automatisch korrigieren solltest:
- `|`-Pipes im Fließtext → meist Spaltentrenner einer Tabelle oder Pipe-Rauschen. Im Tabellen-Kontext als Spalten lesen.
- Fehlende Umlaute (`a` statt `ä`, `o` statt `ö`, `u` statt `ü`) — aus dem Wort rekonstruieren.
- Zusammengeklebte Wörter (z.B. `Handlungsschritt1` statt `Handlungsschritt 1`) — sinngemäß trennen.
- Zahlen vs. Buchstaben (`O` vs. `0`, `l` vs. `1`, `S` vs. `5`) — aus Kontext entscheiden.
- Sehr kurze Seiten (< 150 Zeichen) sind oft **leere Bearbeitungsblätter** oder **reine Diagramme**. Leere Blätter überspringen; Diagrammseiten ggf. als PNG lesen.

---

## Kernregeln für die Fragen

### Fragenqualität
- Jede Frage prüft **genau ein Lernziel**, nicht mehrere auf einmal.
- Sprache: **Deutsch**, IHK-typisches Vokabular.
- Niveau: **IHK-Abschlussprüfung** — nicht trivial, aber mit Schulstoff lösbar.
- Fragenstamm **1–4 Sätze**, Optionen je **max. 15 Wörter**.
- Keine Verneinungen in der Frage (außer sinnvoll).

### Optionen
- **Immer exakt 4 Optionen** (Index 0–3).
- **1–3 richtige** Antworten pro Frage (`correct_indices` ist Array).
- Distraktoren müssen **plausibel** sein (typische Denkfehler, Nachbarkonzepte). **Keine Lückenfüller**.
- Alle Optionen **ähnlich lang und detailliert**.

### Hinweis & Lösung
- `hint`: **verrät nicht die Antwort**. 1–2 Sätze.
- `solution`: **ausführliche Erklärung**, 3–8 Sätze. Markdown erlaubt.

### Themen (wähle EXAKT aus dieser Liste)
`SQL`, `UML-Klassendiagramm`, `UML-Aktivität`, `UML-Anwendungsfall`, `UML-Sequenz`, `UML-Zustand`, `ER-Modell`, `OOP-Konzepte`, `Pseudocode`, `Algorithmen-Komplexität`, `Datenstrukturen`, `Netzwerke`, `IT-Sicherheit`, `Kryptografie`, `Projektmanagement`, `Qualitätssicherung`, `Testverfahren`, `Projektplanung`, `Wirtschaftlichkeit`, `Datenschutz-DSGVO`, `Kundenkommunikation`, `WiSo-Recht`, `WiSo-Sozialversicherung`, `WiSo-Tarifvertrag`, `WiSo-Betriebsrat`, `WiSo-Ausbildung`, `Hardware`, `Betriebssysteme`, `Softwarelizenz`, `Barrierefreiheit`, `Design-Patterns`.

Nur wenn **absolut kein** Thema passt: neues Label **max. 30 Zeichen**.

### Schwierigkeit
- `leicht` — direkt aus Faktenwissen ableitbar
- `mittel` — Anwendung / Transfer
- `schwer` — mehrschrittig, Konzepte kombinieren

### Quantität
**2–6 Fragen pro Handlungsschritt**, je nach Anzahl eigenständiger Lernziele. Qualität > Quantität.

### Diagramme
Bei diagrammbezogenen Aufgaben: `has_diagram: true` und `source_page` = Aufgabenseite. Die Original-PNG wird später im Quiz direkt angezeigt — du musst das Diagramm nicht in Worte rekonstruieren.

---

## Output-Format

Siehe `output-format.md`. **Nur gültiges JSON** in die Datei schreiben — keine ```json-Umrahmung, kein Kommentartext in der Datei.
