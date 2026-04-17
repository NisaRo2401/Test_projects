# UML Lernwerkzeug – Codedokumentation

Standalone HTML-Datei (kein Build-Prozess, keine Dependencies) für die IHK FIAE Prüfungsvorbereitung.
Im Browser öffnen oder per Live Server in VS Code starten.

---

## Dateistruktur

```
uml-lernwerkzeug.html
├── <style>          CSS – Layout, Komponenten, Theme-Variablen
├── <body>           HTML – App-Struktur
│   ├── .hdr         Kopfzeile (Diagrammtyp-Tabs, Ansichts-Tabs)
│   └── .main
│       ├── .sidebar Symbolpalette, Verbindungstyp, Modus-Buttons
│       └── .cwrap   SVG-Zeichenfläche + Overlay-Elemente
├── #v-ex            Aufgaben-Panel (display:none wenn nicht aktiv)
├── #v-th            Theorie-Panel  (display:none wenn nicht aktiv)
└── <script>         Gesamte App-Logik (~500 Zeilen)
```

---

## JavaScript-Architektur

### Globaler State `S`

```js
let S = {
  dt:   'uc',   // Aktiver Diagrammtyp: 'uc' | 'cl' | 'av'
  els:  [],     // Array aller platzierten Elemente (Knoten)
  cns:  [],     // Array aller Verbindungen (Kanten)
  sel:  null,   // ID des aktuell selektierten Elements
  mode: 's',    // Interaktionsmodus: 's' | 'c' | 'd'
  cf:   null,   // ID der Verbindungs-Quelle (beim Verbinden)
  ct:   'assoc',// Aktiver Verbindungstyp
  vw:   'cv',   // Aktive Ansicht: 'cv' | 'ex' | 'th'
  ex:   null,   // ID der aktiven Übungsaufgabe
  drag: null,   // Drag-State { id, ox, oy }
  edit: null,   // ID des Elements im Bearbeitungsmodus
  n:    0,      // Zähler für eindeutige IDs
  tdt:  'uc',   // Aktiver Tab im Theorie-Panel
}
```

### Element-Objekt (`els[]`)

```js
{
  id:  'e42',       // Eindeutige ID (nid())
  t:   'cls',       // Typ: 'actor'|'uc'|'sys'|'cls'|'ifc'|'enm'|
                    //       'start'|'end'|'act'|'dec'|'fork'|'note'
  x:   100,         // Position X (linke Kante)
  y:   80,          // Position Y (obere Kante)
  w:   170,         // Breite
  h:   120,         // Höhe (dynamisch bei Klassen!)
  lb:  'Klasse',    // Label / Name
  at:  ['+ name: String'],  // Attribute (nur cls/ifc/enm)
  mt:  ['+ getName()'],     // Methoden (nur cls/ifc)
}
```

### Verbindungs-Objekt (`cns[]`)

```js
{
  id:   'e7',     // Eindeutige ID
  from: 'e1',     // ID des Quellelements
  to:   'e3',     // ID des Zielelements
  ct:   'inh',    // Verbindungstyp (siehe CO-Objekt)
  lb:   '',       // Optionales Label (z.B. Multiplizität)
}
```

---

## Wichtige Funktionen

| Funktion | Beschreibung |
|---|---|
| `render()` | Neuzeichnen aller SVG-Elemente + UI-State aktualisieren |
| `shp(el, sel)` | Erzeugt SVG-Markup für ein Element |
| `bcnSVG(cn)` | Erzeugt SVG-Markup für eine Verbindung |
| `edgePt(el, tx, ty)` | Berechnet den Randpunkt eines Elements (für Pfeilansatz) |
| `csty(ct)` | Gibt Verbindungsstil zurück (Farbe, Strichelung, Pfeilkopf) |
| `bpal()` | Baut die Symbolpalette (sidebar) neu auf |
| `bcsel()` | Befüllt das Verbindungstyp-Dropdown |
| `swVw(vw)` | Wechselt zwischen Ansichten (cv/ex/th) |
| `swDt(dt)` | Wechselt Diagrammtyp, leert die Fläche |
| `startEx(id)` | Lädt eine Übungsaufgabe |
| `checkEx()` | Prüft das aktuelle Diagramm gegen Aufgaben-Kriterien |
| `bex()` | Baut das Aufgaben-Panel auf |
| `bth()` | Baut das Theorie-Panel auf |
| `commitEdit()` | Speichert die Inline-Texteingabe |
| `nid()` | Erzeugt eine neue eindeutige Element-ID |

---

## Konfigurationsobjekte

### `ED` – Element-Definitionen

Standardgrößen und Default-Labels für jeden Elementtyp:

```js
const ED = {
  actor: { w: 62,  h: 88,  lb: 'Actor' },
  uc:    { w: 150, h: 60,  lb: 'Use Case' },
  sys:   { w: 240, h: 180, lb: 'System' },
  cls:   { w: 170, h: 120, lb: 'Klasse', at: [...], mt: [...] },
  // ...
}
```

### `PAL` – Palette pro Diagrammtyp

```js
const PAL = {
  uc: ['actor', 'uc', 'sys', 'note'],
  cl: ['cls', 'ifc', 'enm', 'note'],
  av: ['start', 'act', 'dec', 'fork', 'end', 'note'],
}
```

### `CO` – Verbindungstypen pro Diagrammtyp

```js
const CO = {
  uc: [
    { v: 'assoc', l: 'Assoziation ─────' },
    { v: 'inc',   l: '«include» - - ->'  },
    { v: 'ext',   l: '«extend» - - ->'   },
    { v: 'gen',   l: 'Generalisierung ──▷' },
  ],
  cl: [ /* assoc, inh, real, agg, comp, dep */ ],
  av: [ /* trans, guard */ ],
}
```

### `EX` – Übungsaufgaben

Jede Aufgabe hat:

```js
{
  id:    1,
  dt:    'uc',                  // Diagrammtyp
  ti:    'Bibliothekssystem',   // Titel
  tx:    '...',                 // Aufgabentext (mehrzeilig)
  hints: ['...'],               // Tipps bei falscher Lösung
  va:    (els, cns) => ({       // Validierungsfunktion
    ok: boolean,                // Gesamt bestanden?
    ch: [{ t: 'Text', ok: boolean }]  // Einzelkriterien
  })
}
```

**Neue Aufgabe hinzufügen:**

```js
{
  id: 9,
  dt: 'cl',
  ti: 'Mein Thema',
  tx: 'Aufgabenbeschreibung...',
  hints: ['Hinweis 1', 'Hinweis 2'],
  va: (e, c) => ({
    ok: e.filter(x => x.t === 'cls').length >= 2 && c.length >= 1,
    ch: [
      { t: 'Mindestens 2 Klassen', ok: e.filter(x => x.t === 'cls').length >= 2 },
      { t: 'Mindestens 1 Verbindung', ok: c.length >= 1 },
    ]
  })
}
```

### `TH` – Theorie-Einträge

```js
TH = {
  uc: [ { n: 'Name', d: 'Beschreibung', sym: 'actor' }, ... ],
  cl: [ ... ],
  av: [ ... ],
}
```

`sym` verweist auf einen Eintrag in `thSymSVG()` – dort wird das Vorschau-Symbol gerendert.

---

## SVG-Struktur der Zeichenfläche

```
<svg id="cv">
  <defs>
    <!-- Gittermuster, Pfeilköpfe (marker) -->
  </defs>
  <rect fill="url(#grid)"/>   <!-- Hintergrundgitter -->
  <g id="cg"></g              <!-- Verbindungen (Kanten) -->
  <g id="eg"></g>             <!-- Elemente (Knoten) -->
</svg>
```

Verbindungen liegen **unter** den Elementen (cg vor eg).

### Pfeilköpfe (marker IDs)

| ID | Verwendung |
|---|---|
| `#ma` | Einfacher Pfeil (grau) – Assoziation, Include, Extend |
| `#mh` | Hohler Pfeil (grau) – Generalisierung (UC) |
| `#mhp` | Hohler Pfeil (lila) – Vererbung, Realisierung |
| `#map` | Gefüllter Pfeil (lila) – Aggregation/Komposition Ende |
| `#mdh` | Hohle Raute (lila) – Aggregation Anfang |
| `#mdf` | Gefüllte Raute (lila) – Komposition Anfang |
| `#mg` | Grüner Pfeil – Aktivitätsübergänge |

---

## Modi & Tastenkürzel

| Taste | Aktion |
|---|---|
| `S` | Auswahlmodus (select) |
| `C` | Verbindungsmodus (connect) |
| `D` | Löschmodus (delete) |
| `Entf` / `Backspace` | Selektiertes Element löschen |
| Doppelklick auf Element | Inline-Textbearbeitung |

---

## Erweiterungsideen

- **Undo/Redo:** `S.history = []` mit Push bei jeder Änderung, `Ctrl+Z` poppt den letzten State
- **Export als SVG/PNG:** `cvg.outerHTML` als Blob speichern oder `canvas.toDataURL()`
- **Multiplizitäten:** `cn.lb` ist schon vorhanden – Doppelklick auf Verbindung zum Bearbeiten ergänzen
- **Neue Diagrammtypen:** Sequenzdiagramm (`sq`) in `PAL`, `CO`, `ED`, `TH` und `swDt()` ergänzen
- **localStorage:** `JSON.stringify(S.els)` + `S.cns` speichern und beim Laden wiederherstellen
- **Zoom/Pan:** SVG `viewBox` dynamisch anpassen mit Mouse-Wheel-Event
