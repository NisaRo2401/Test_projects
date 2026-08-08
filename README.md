# FIAE Lernhub

Statische, responsive Lernplattform zur Vorbereitung auf die IHK-Prüfung für Fachinformatiker Anwendungsentwicklung. Der zentrale Supabase-Login schützt den Einstieg; die Datenbankzugriffe sind zusätzlich durch Row-Level Security abgesichert.

## Lernmodule

| Modul | Inhalt | Technik |
|---|---|---|
| IHK Exam Trainer | Themenmodus, Prüfungssimulation, Timer, Auswertung und Verlauf | Supabase |
| Pseudocode Trainer | 18 progressive Aufgaben mit Strukturprüfung, Entwürfen und Lernfortschritt | Vanilla JavaScript |
| SQL Learner | 59 Aufgaben von SELECT bis CTE, Window Functions und DML | SQL.js / SQLite WASM |
| UML Lernstudio | Lernkarten, Quiz und interaktiver Diagramm-Builder | SVG, Drag & Drop |
| UML Lernwerkzeug | Freies Modellieren und geführte UML-Aufgaben | SVG, Pointer Events |

## Lokale Vorschau

Die Anwendung benötigt keinen Build-Schritt. Sie muss wegen der Browser-Sicherheitsregeln über HTTP statt direkt als `file://` geöffnet werden.

```bash
python -m http.server 8000
# http://localhost:8000/
```

Alternativ:

```bash
npx http-server -p 8000 -c-1
```

## Qualitätsprüfung

```bash
npm ci --prefix tools
npm test
npm audit --prefix tools --omit=dev
```

Die Tests kontrollieren unter anderem JavaScript-Syntax, tote lokale Links, doppelte IDs, Auth-Reihenfolge, interne Login-Rücksprünge, PDF-Dateinamen, parallele OCR-Worker und die Validierung des Fragenimports. Dieselben Prüfungen sowie ein Docker-Build laufen in GitHub Actions.

## Supabase einrichten

1. `docs/supabase-setup.sql` im Supabase SQL Editor ausführen.
2. Danach `docs/ihk-exam-schema.sql` ausführen.
3. In der Supabase-URL-Konfiguration die Produktionsdomain als **Site URL** und erlaubte Redirect URL eintragen.
4. Einen öffentlichen Publishable-Key verwenden. Secret- oder Service-Role-Keys dürfen nie im Frontend stehen.

Die mitgelieferte `assets/js/config.js` enthält die aktuelle Browserkonfiguration. Im Docker-Betrieb wird sie beim Containerstart sicher aus `SUPABASE_URL` und `SUPABASE_PUBLISHABLE_KEY` erzeugt. Legacy-Projekte können weiterhin `SUPABASE_ANON_KEY` verwenden.

## Produktion mit Docker

```bash
cp .env.example .env
# .env mit Produktionswerten füllen
docker compose up -d --build
curl http://127.0.0.1:8080/healthz
```

Der Container:

- liefert ausschließlich die produktiven Frontend-Dateien aus;
- läuft auf internem Port `8080` und ist standardmäßig nur an `127.0.0.1` gebunden;
- stellt `/healthz` für Monitoring bereit;
- setzt CSP, Clickjacking-, MIME- und Referrer-Schutzheader;
- komprimiert statische Dateien und verhindert veraltetes Caching der Laufzeitkonfiguration.

Vor den Container gehört auf dem Server ein HTTPS-Reverse-Proxy, der die öffentliche Domain auf `127.0.0.1:${APP_PORT:-8080}` weiterleitet.

### Deployment unter `projects.noxsolutions.de`

Die bestehende Hauptseite unter `noxsolutions.de` bleibt unverändert. Für den Lernhub wird beim DNS-Anbieter ein eigener `A`-Record `projects` auf die IPv4-Adresse des vServers gesetzt; wenn IPv6 auf dem Server aktiv ist, zusätzlich ein entsprechender `AAAA`-Record.

Auf dem Ubuntu-Server mit Apache:

```bash
sudo a2enmod proxy proxy_http headers ssl rewrite
sudo cp deploy/apache-projects.noxsolutions.de.conf /etc/apache2/sites-available/projects.noxsolutions.de.conf
sudo a2ensite projects.noxsolutions.de.conf
sudo apache2ctl configtest
sudo systemctl reload apache2

sudo certbot --apache -d projects.noxsolutions.de
```

Der Container bleibt ausschließlich über `127.0.0.1:8080` erreichbar; Apache übernimmt die öffentliche Subdomain und das TLS-Zertifikat. Nach dem Deployment werden `https://projects.noxsolutions.de/` und `https://projects.noxsolutions.de/healthz` geprüft.

## Projektstruktur

```text
.
├── index.html / login.html      Dashboard und Authentifizierung
├── assets/                      gemeinsames Design, Auth, Navigation, Konfiguration
├── modules/                     alle eigenständigen Lernanwendungen
├── docs/                        idempotente Supabase-Schemas und Sicherheitsmodell
├── tools/                       PDF-, OCR- und Fragenimport-Pipeline
├── tests/                       automatisierte Regressionstests
├── deploy/                      Nginx- und Runtime-Konfiguration
├── Dockerfile / compose.yaml    Produktionscontainer
└── .github/workflows/           CI-Qualitätsprüfung
```

## IHK-Prüfungen importieren

```bash
cd tools
cp .env.example .env
npm ci

npm run extract -- --dir ./input-pdfs/
npm run ocr -- --dir ./output/
# questions.json anhand prompts/system.md und prompts/output-format.md erzeugen
npm run insert -- --dir ./output/ --dry-run
npm run insert -- --dir ./output/
```

Die Pipeline ist idempotent, beendet fehlerhafte Batch-Läufe mit einem Fehlercode und akzeptiert für den serverseitigen Import bevorzugt `SUPABASE_SECRET_KEY`; der Legacy-Name `SUPABASE_SERVICE_ROLE_KEY` bleibt unterstützt. Details stehen in [tools/README.md](tools/README.md).
