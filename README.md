# Test Projects Hub

Interaktive Lernplattform für die IHK FIAE-Prüfungsvorbereitung. Enthält drei eigenständige Lernmodule mit zentralem Login über Supabase Auth.

## Schnellstart

```bash
# Im übergeordneten Ordner (Development/)
npm run dev
# → http://localhost:8080/Test_projects/
```

## Projektstruktur

```
Test_projects/
├── index.html              # Dashboard (geschützt)
├── login.html              # Authentifizierung
│
├── assets/
│   ├── css/
│   │   ├── variables.css   # Design-Tokens (Farben, Abstände, Radien)
│   │   ├── base.css        # Reset & Basis-Stile
│   │   └── components.css  # Buttons, Cards, Forms, Nav-Chip
│   └── js/
│       ├── auth.js         # Supabase Auth-Client
│       ├── protect.js      # Seitenschutz (redirect wenn nicht eingeloggt)
│       └── nav.js          # "← Dashboard"-Chip für alle Module
│
├── modules/
│   ├── pseudocode-trainer/ # IHK-Pseudocode IDE (10 Aufgaben)
│   ├── sql-learner/        # SQL-Quest mit in-browser SQLite (30+ Aufgaben)
│   └── uml-trainer/        # UML-Lernstudio (Lernen, Quiz, Trainer)
│
└── docs/
    ├── supabase-setup.sql  # Profiles-Tabelle + RLS + Trigger
    └── SUPABASE_ACCESS_CONTROL.md
```

## Authentifizierung

Jede Seite ist durch Supabase Auth geschützt. Nicht eingeloggte Nutzer werden automatisch zu `login.html` weitergeleitet.

### Supabase einrichten

1. SQL aus `docs/supabase-setup.sql` im [Supabase SQL-Editor](https://supabase.com/dashboard) ausführen
2. URL und Anon-Key bei Bedarf in `assets/js/auth.js` aktualisieren

### Neues Modul hinzufügen

1. Ordner unter `modules/mein-modul/` anlegen
2. Am Ende der HTML-Datei einfügen:
   ```html
   <script>window.APP_BASE_PATH = '../..';</script>
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
   <script src="../../assets/js/auth.js"></script>
   <script src="../../assets/js/protect.js" defer></script>
   <script src="../../assets/js/nav.js" defer></script>
   ```
3. Karte in `index.html` im `.module-grid` ergänzen

## Module

| Modul | Beschreibung | Technologie |
|---|---|---|
| Pseudocode Trainer | 10 IHK-Aufgaben mit Pattern-Matching-Validierung | Vanilla JS, LocalStorage |
| SQL Learner | 30+ SQL-Übungen mit Echtzeit-Ausführung | SQL.js (WASM SQLite) |
| UML Trainer | Lernkarten, Quiz und interaktiver Diagram-Builder | SVG, Drag & Drop |

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JS (kein Framework, kein Build-Step)
- **Auth & DB**: Supabase (PostgreSQL + Auth)
- **Dev-Server**: `http-server` via npm
- **CSS-Architektur**: Design-Tokens → Base → Components (kaskadierend)
