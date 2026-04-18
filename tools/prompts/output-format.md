# Ausgabeformat für MC-Fragen

Wenn du (Claude Code) ein extrahiertes Aufgaben-JSON in MC-Fragen umwandelst, **schreibe das Ergebnis in folgendes Format**:

```json
{
  "source_pdf": "<der Dateiname aus dem Input-JSON>",
  "exam_part":   "AP1 | GA1 | GA2 | WiSo",
  "exam_year":   2023,
  "exam_season": "Sommer | Winter",
  "questions": [
    {
      "topic":           "SQL",
      "subtopic":        "JOIN",
      "question":        "Welche SQL-Klausel…?",
      "options":         ["A …", "B …", "C …", "D …"],
      "correct_indices": [0],
      "hint":            "Denk an …",
      "solution":        "Ausführliche Erklärung, warum A korrekt ist und B/C/D nicht.",
      "difficulty":      "leicht | mittel | schwer",
      "has_diagram":     false,
      "source_page":     7
    }
  ]
}
```

## Pflichtfelder pro Frage

| Feld | Typ | Regel |
|---|---|---|
| `topic` | string | aus Themenliste (siehe `system.md`) |
| `question` | string | 1–4 Sätze, präzise |
| `options` | array | **genau 4** Einträge |
| `correct_indices` | int[] | 1–3 Werte aus 0–3 |
| `solution` | string | ausführliche Erklärung |
| `difficulty` | string | `leicht`, `mittel`, `schwer` |

## Optional

`subtopic`, `hint`, `has_diagram`, `source_page`, `diagram_url`.

## Speichern

Ablage unter `tools/output/<pdfname>.questions.json`. Dann:

```bash
node insert-questions.mjs --file ./output/<pdfname>.questions.json
```
