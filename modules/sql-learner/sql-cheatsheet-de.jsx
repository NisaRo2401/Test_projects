import { useState } from "react";

const sections = [
  {
    id: "basics",
    label: "Grundlagen",
    color: "#4ade80",
    items: [
      {
        title: "SELECT",
        desc: "Liest Daten aus einer Tabelle. Mit * werden alle Spalten zurückgegeben, mit DISTINCT werden doppelte Zeilen entfernt.",
        code: `SELECT col1, col2 FROM table;
SELECT * FROM table;
SELECT DISTINCT col FROM table;`,
      },
      {
        title: "WHERE",
        desc: "Filtert Zeilen nach Bedingungen. Mehrere Bedingungen lassen sich mit AND / OR kombinieren.",
        code: `SELECT * FROM table
WHERE col = 'wert';
WHERE col != 'x' AND col2 > 5;
WHERE col IN ('a', 'b', 'c');
WHERE col BETWEEN 10 AND 20;
WHERE col IS NULL;
WHERE col LIKE '%muster%';`,
      },
      {
        title: "ORDER BY & LIMIT",
        desc: "Sortiert das Ergebnis (ASC = aufsteigend, DESC = absteigend) und begrenzt die Anzahl der zurückgegebenen Zeilen. OFFSET überspringt die ersten N Zeilen – nützlich für Paginierung.",
        code: `SELECT * FROM table
ORDER BY col ASC;
ORDER BY col DESC;
ORDER BY col1 ASC, col2 DESC;
LIMIT 10;
LIMIT 10 OFFSET 20;  -- Seite 3 bei 10 pro Seite`,
      },
      {
        title: "Aliase (AS)",
        desc: "Gibt Spalten oder Tabellen einen temporären Namen im Ergebnis – verbessert die Lesbarkeit und ist Pflicht bei Subqueries.",
        code: `SELECT vorname AS name, gehalt * 12 AS jahresgehalt
FROM mitarbeiter AS m
WHERE m.abteilung = 'IT';`,
      },
    ],
  },
  {
    id: "joins",
    label: "JOINs",
    color: "#60a5fa",
    items: [
      {
        title: "INNER JOIN",
        desc: "Gibt nur Zeilen zurück, die in BEIDEN Tabellen einen passenden Wert haben. Nicht übereinstimmende Zeilen werden weggelassen.",
        code: `SELECT a.name, b.bezeichnung
FROM bestellungen a
INNER JOIN produkte b ON a.produkt_id = b.id;`,
      },
      {
        title: "LEFT JOIN",
        desc: "Gibt ALLE Zeilen der linken Tabelle zurück. Fehlt ein passender Eintrag in der rechten Tabelle, werden die Spalten mit NULL aufgefüllt.",
        code: `-- Alle Kunden, auch ohne Bestellung
SELECT k.name, b.betrag
FROM kunden k
LEFT JOIN bestellungen b ON k.id = b.kunden_id;`,
      },
      {
        title: "RIGHT JOIN",
        desc: "Wie LEFT JOIN, aber alle Zeilen der rechten Tabelle werden behalten. In der Praxis seltener – oft als LEFT JOIN umgeschrieben.",
        code: `SELECT k.name, b.betrag
FROM bestellungen b
RIGHT JOIN kunden k ON b.kunden_id = k.id;`,
      },
      {
        title: "FULL OUTER JOIN",
        desc: "Gibt alle Zeilen beider Tabellen zurück. Wo kein Match existiert, stehen NULLs. Nicht in MySQL verfügbar – dort UNION aus zwei JOINs nutzen.",
        code: `SELECT * FROM tabelle_a a
FULL OUTER JOIN tabelle_b b ON a.id = b.id;`,
      },
      {
        title: "SELF JOIN",
        desc: "Verbindet eine Tabelle mit sich selbst. Typisch für Hierarchien wie Mitarbeiter–Vorgesetzter oder Kategorie–Oberkategorie.",
        code: `SELECT m.name, v.name AS vorgesetzter
FROM mitarbeiter m
JOIN mitarbeiter v ON m.vorgesetzter_id = v.id;`,
      },
    ],
  },
  {
    id: "aggregate",
    label: "Aggregation",
    color: "#f472b6",
    items: [
      {
        title: "Aggregatfunktionen",
        desc: "Berechnen einen einzigen Wert aus mehreren Zeilen. COUNT(*) zählt alle Zeilen, COUNT(col) ignoriert NULLs.",
        code: `SELECT COUNT(*)           FROM tabelle;
SELECT COUNT(DISTINCT col) FROM tabelle;
SELECT SUM(betrag)         FROM tabelle;
SELECT AVG(gehalt)         FROM tabelle;
SELECT MIN(preis), MAX(preis) FROM tabelle;`,
      },
      {
        title: "GROUP BY",
        desc: "Fasst Zeilen mit gleichem Spaltenwert zu Gruppen zusammen. Jede Gruppe liefert eine Ergebniszeile. Alle Spalten im SELECT müssen entweder aggregiert oder im GROUP BY stehen.",
        code: `SELECT abteilung, COUNT(*) AS anzahl, AVG(gehalt) AS durchschnitt
FROM mitarbeiter
GROUP BY abteilung;`,
      },
      {
        title: "HAVING",
        desc: "Filtert Gruppen nach der Aggregation – analog zu WHERE, aber für GROUP BY. WHERE läuft VOR der Gruppierung, HAVING DANACH.",
        code: `SELECT abteilung, SUM(gehalt) AS gesamtgehalt
FROM mitarbeiter
GROUP BY abteilung
HAVING SUM(gehalt) > 50000;`,
      },
    ],
  },
  {
    id: "modify",
    label: "Daten ändern",
    color: "#fb923c",
    items: [
      {
        title: "INSERT",
        desc: "Fügt neue Zeilen in eine Tabelle ein. Die zweite Variante kopiert Daten direkt aus einer anderen Tabelle.",
        code: `INSERT INTO nutzer (name, email)
VALUES ('Anna Müller', 'anna@example.de');

-- Daten aus anderer Tabelle einfügen
INSERT INTO archiv (name, email)
SELECT name, email FROM nutzer WHERE aktiv = false;`,
      },
      {
        title: "UPDATE",
        desc: "Ändert bestehende Zeilen. WICHTIG: Immer WHERE angeben – sonst werden ALLE Zeilen aktualisiert!",
        code: `UPDATE nutzer
SET name = 'Anna Schmidt', aktiv = true
WHERE id = 42;`,
      },
      {
        title: "DELETE",
        desc: "Löscht Zeilen. Wie beim UPDATE: ohne WHERE werden ALLE Zeilen gelöscht. TRUNCATE ist schneller als DELETE ohne WHERE, setzt auch Auto-Increment zurück.",
        code: `DELETE FROM nutzer WHERE id = 42;

-- Alle Zeilen löschen (Struktur bleibt)
TRUNCATE TABLE nutzer;`,
      },
    ],
  },
  {
    id: "ddl",
    label: "Tabellenstruktur",
    color: "#a78bfa",
    items: [
      {
        title: "CREATE TABLE",
        desc: "Erstellt eine neue Tabelle mit Spalten und Datentypen. Constraints wie PRIMARY KEY, NOT NULL und UNIQUE sichern die Datenintegrität.",
        code: `CREATE TABLE nutzer (
  id        INT PRIMARY KEY AUTO_INCREMENT,
  name      VARCHAR(100) NOT NULL,
  email     VARCHAR(255) UNIQUE,
  alter     INT DEFAULT 0,
  erstellt  TIMESTAMP DEFAULT NOW()
);`,
      },
      {
        title: "ALTER TABLE",
        desc: "Ändert die Struktur einer bestehenden Tabelle: Spalten hinzufügen, umbenennen, ändern oder entfernen – ohne Datenverlust.",
        code: `ALTER TABLE nutzer ADD COLUMN telefon VARCHAR(20);
ALTER TABLE nutzer DROP COLUMN telefon;
ALTER TABLE nutzer RENAME COLUMN alt TO neu;
ALTER TABLE nutzer MODIFY COLUMN alter BIGINT;`,
      },
      {
        title: "DROP & TRUNCATE",
        desc: "DROP löscht die Tabelle komplett (Daten + Struktur). TRUNCATE löscht alle Daten, behält aber die Tabellenstruktur.",
        code: `DROP TABLE tabelle_name;
DROP TABLE IF EXISTS tabelle_name;  -- kein Fehler wenn nicht vorhanden
TRUNCATE TABLE tabelle_name;`,
      },
      {
        title: "FOREIGN KEY",
        desc: "Referenzielle Integrität: stellt sicher, dass ein Wert in einer anderen Tabelle existieren muss. ON DELETE CASCADE löscht Kind-Zeilen automatisch mit.",
        code: `CREATE TABLE bestellungen (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  kunden_id  INT NOT NULL,
  FOREIGN KEY (kunden_id)
    REFERENCES kunden(id)
    ON DELETE CASCADE
);`,
      },
    ],
  },
  {
    id: "advanced",
    label: "Fortgeschritten",
    color: "#facc15",
    items: [
      {
        title: "Subquery (Unterabfrage)",
        desc: "Eine SELECT-Abfrage innerhalb einer anderen. Kann im WHERE (als Filter), im FROM (als virtuelle Tabelle) oder im SELECT (als berechnete Spalte) stehen.",
        code: `-- Im WHERE: Kunden aus DE filtern
SELECT * FROM bestellungen
WHERE kunden_id IN (
  SELECT id FROM kunden WHERE land = 'DE'
);

-- Im FROM: Ergebnis als Tabelle nutzen
SELECT * FROM (
  SELECT abt, AVG(gehalt) AS avg_g FROM mitarbeiter GROUP BY abt
) AS abt_stats WHERE avg_g > 4000;`,
      },
      {
        title: "CTE (WITH)",
        desc: "Common Table Expression: eine benannte, temporäre Ergebnismenge. Macht komplexe Abfragen deutlich lesbarer als verschachtelte Subqueries. Gilt nur für die folgende Abfrage.",
        code: `WITH aktive_kunden AS (
  SELECT * FROM kunden WHERE aktiv = true
),
grosse_bestellungen AS (
  SELECT * FROM bestellungen WHERE betrag > 500
)
SELECT k.name, b.betrag
FROM aktive_kunden k
JOIN grosse_bestellungen b ON k.id = b.kunden_id;`,
      },
      {
        title: "Window-Funktionen",
        desc: "Berechnen Werte über eine Gruppe (Partition), ohne Zeilen zusammenzufassen – jede Zeile bleibt erhalten. Ideal für Rankings, laufende Summen und Vergleiche innerhalb von Gruppen.",
        code: `SELECT name, gehalt, abteilung,
  RANK()       OVER (ORDER BY gehalt DESC) AS gesamt_rang,
  ROW_NUMBER() OVER (PARTITION BY abteilung
                     ORDER BY gehalt DESC) AS rang_in_abt,
  SUM(gehalt)  OVER (PARTITION BY abteilung) AS abt_summe,
  AVG(gehalt)  OVER () AS firma_durchschnitt
FROM mitarbeiter;`,
      },
      {
        title: "CASE WHEN",
        desc: "Bedingte Logik direkt im SQL – wie ein if/else. Kann im SELECT (für neue Spalten), im WHERE oder im ORDER BY verwendet werden.",
        code: `SELECT name, punkte,
  CASE
    WHEN punkte >= 90 THEN 'Sehr gut'
    WHEN punkte >= 75 THEN 'Gut'
    WHEN punkte >= 60 THEN 'Befriedigend'
    ELSE                   'Nicht bestanden'
  END AS bewertung
FROM pruefungen;`,
      },
      {
        title: "Rekursive CTE",
        desc: "Ermöglicht rekursive Abfragen – ideal für Baumstrukturen wie Kategorien, Organigramme oder Stücklisten.",
        code: `WITH RECURSIVE baum AS (
  -- Ankerpunkt: Wurzel
  SELECT id, name, parent_id, 0 AS tiefe
  FROM kategorien WHERE parent_id IS NULL

  UNION ALL

  -- Rekursiver Teil
  SELECT k.id, k.name, k.parent_id, b.tiefe + 1
  FROM kategorien k
  JOIN baum b ON k.parent_id = b.id
)
SELECT * FROM baum ORDER BY tiefe;`,
      },
    ],
  },
  {
    id: "indexes",
    label: "Indizes & Performance",
    color: "#2dd4bf",
    items: [
      {
        title: "Indizes erstellen",
        desc: "Ein Index beschleunigt SELECT-Abfragen erheblich, verlangsamt aber INSERT/UPDATE/DELETE leicht. Sinnvoll für Spalten, die häufig in WHERE, JOIN oder ORDER BY vorkommen.",
        code: `-- Einfacher Index
CREATE INDEX idx_name ON nutzer (nachname);

-- Eindeutiger Index (wie UNIQUE Constraint)
CREATE UNIQUE INDEX idx_email ON nutzer (email);

-- Zusammengesetzter Index (Reihenfolge wichtig!)
CREATE INDEX idx_abt_gehalt ON mitarbeiter (abteilung, gehalt);

-- Index löschen
DROP INDEX idx_name ON nutzer;`,
      },
      {
        title: "EXPLAIN (Abfrageplan)",
        desc: "Zeigt, wie die Datenbank eine Abfrage intern ausführt – ob ein Index genutzt wird, wie viele Zeilen durchsucht werden und wo Flaschenhälse liegen. Unverzichtbar zur Performance-Analyse.",
        code: `-- Abfrageplan anzeigen
EXPLAIN SELECT * FROM nutzer WHERE email = 'x@y.de';

-- Mit tatsächlichen Laufzeitdaten (PostgreSQL)
EXPLAIN ANALYZE SELECT * FROM nutzer WHERE email = 'x@y.de';`,
      },
      {
        title: "Nützliche String-Funktionen",
        desc: "Häufig verwendete eingebaute Funktionen für die Arbeit mit Text.",
        code: `SELECT UPPER(name), LOWER(email) FROM nutzer;
SELECT LENGTH(name) FROM nutzer;
SELECT TRIM('  hallo  ');          -- 'hallo'
SELECT SUBSTRING(name, 1, 3);     -- erste 3 Zeichen
SELECT CONCAT(vorname, ' ', nachname) AS vollname
FROM nutzer;
SELECT REPLACE(text, 'alt', 'neu') FROM tabelle;`,
      },
      {
        title: "Nützliche Datumsfunktionen",
        desc: "Funktionen zum Arbeiten mit Datums- und Zeitwerten (Syntax kann je nach DB leicht abweichen).",
        code: `SELECT NOW();                         -- aktuelles Datum + Uhrzeit
SELECT CURDATE();                     -- nur Datum
SELECT YEAR(erstellt), MONTH(erstellt) FROM tabelle;
SELECT DATEDIFF(NOW(), erstellt) AS tage_alt FROM tabelle;
SELECT DATE_FORMAT(erstellt, '%d.%m.%Y') FROM tabelle;
SELECT erstellt + INTERVAL 30 DAY FROM tabelle;`,
      },
    ],
  },
  {
    id: "transactions",
    label: "Transaktionen",
    color: "#f87171",
    items: [
      {
        title: "ACID & Grundprinzip",
        desc: "Eine Transaktion ist eine Gruppe von Operationen, die entweder komplett durchgeführt oder komplett rückgängig gemacht wird. ACID steht für Atomicity, Consistency, Isolation, Durability.",
        code: `START TRANSACTION;

  UPDATE konten SET saldo = saldo - 100 WHERE id = 1;
  UPDATE konten SET saldo = saldo + 100 WHERE id = 2;

COMMIT;   -- alles erfolgreich: dauerhaft speichern`,
      },
      {
        title: "ROLLBACK & SAVEPOINT",
        desc: "ROLLBACK macht alle Änderungen seit dem letzten COMMIT rückgängig. SAVEPOINTs erlauben ein teilweises Zurücksetzen innerhalb einer Transaktion.",
        code: `START TRANSACTION;

  INSERT INTO log (msg) VALUES ('Start');
  SAVEPOINT nach_log;

  UPDATE produkte SET lager = lager - 5 WHERE id = 99;

  -- Fehler erkannt: nur bis Savepoint zurück
  ROLLBACK TO SAVEPOINT nach_log;

COMMIT;`,
      },
    ],
  },
];

const KEYWORDS = ["SELECT","FROM","WHERE","JOIN","INNER","LEFT","RIGHT","FULL","OUTER","ON","GROUP BY","ORDER BY","HAVING","LIMIT","OFFSET","INSERT INTO","VALUES","UPDATE","SET","DELETE","TRUNCATE","CREATE","ALTER","DROP","TABLE","INDEX","WITH","RECURSIVE","AS","CASE","WHEN","THEN","ELSE","END","DISTINCT","IN","BETWEEN","LIKE","IS NULL","NOT","AND","OR","BY","ASC","DESC","PARTITION","OVER","RANK","ROW_NUMBER","SUM","COUNT","AVG","MIN","MAX","UNIQUE","PRIMARY KEY","AUTO_INCREMENT","DEFAULT","NOT NULL","IF EXISTS","ANALYZE","EXPLAIN","ADD","MODIFY","RENAME","COLUMN","CONSTRAINT","REFERENCES","FOREIGN KEY","ON DELETE CASCADE","START TRANSACTION","COMMIT","ROLLBACK","SAVEPOINT","ROLLBACK TO SAVEPOINT","UNION ALL","UNION","INTERVAL","DATE_FORMAT","DATEDIFF","CURDATE","NOW","UPPER","LOWER","LENGTH","TRIM","SUBSTRING","CONCAT","REPLACE","VARCHAR","INT","BIGINT","TIMESTAMP","BOOLEAN"];

function highlight(code) {
  return code.split("\n").map((line, li) => {
    if (line.trim().startsWith("--")) {
      return <div key={li} style={{ color: "#6b7280", fontStyle: "italic" }}>{line || " "}</div>;
    }
    const parts = [];
    let i = 0;
    while (i < line.length) {
      let matched = false;
      const upper = line.slice(i).toUpperCase();
      for (const kw of KEYWORDS) {
        if (upper.startsWith(kw) && (i === 0 || /[\s,(=!<>]/.test(line[i-1]))) {
          const after = line[i + kw.length];
          if (!after || /[\s;,()\n]/.test(after)) {
            parts.push(<span key={i} style={{ color: "#60a5fa", fontWeight: 700 }}>{line.slice(i, i + kw.length)}</span>);
            i += kw.length;
            matched = true;
            break;
          }
        }
      }
      if (!matched) {
        if (line[i] === "'") {
          let j = i + 1;
          while (j < line.length && line[j] !== "'") j++;
          parts.push(<span key={i} style={{ color: "#4ade80" }}>{line.slice(i, j + 1)}</span>);
          i = j + 1;
        } else if (/\d/.test(line[i]) && (i === 0 || /[\s,=(]/.test(line[i-1]))) {
          let j = i;
          while (j < line.length && /[\d.]/.test(line[j])) j++;
          parts.push(<span key={i} style={{ color: "#fb923c" }}>{line.slice(i, j)}</span>);
          i = j;
        } else {
          parts.push(<span key={i} style={{ color: "#e2e8f0" }}>{line[i]}</span>);
          i++;
        }
      }
    }
    return <div key={li} style={{ minHeight: "1.7em" }}>{parts.length ? parts : null}</div>;
  });
}

export default function SQLCheatSheet() {
  const [active, setActive] = useState("basics");
  const [expanded, setExpanded] = useState({});
  const [copied, setCopied] = useState(null);

  const section = sections.find(s => s.id === active);

  const copy = (code, key) => {
    navigator.clipboard.writeText(code);
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
  };

  const toggleDesc = (key) => {
    setExpanded(e => ({ ...e, [key]: !e[key] }));
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080d18",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      color: "#e2e8f0",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        padding: "24px 28px 16px",
        borderBottom: "1px solid #1a2840",
        background: "linear-gradient(135deg, #0c1525 0%, #090f1e 100%)",
      }}>
        <div style={{ fontSize: 10, color: "#4ade80", letterSpacing: 4, textTransform: "uppercase", fontWeight: 700 }}>
          ▶ referenz
        </div>
        <h1 style={{ margin: "4px 0 2px", fontSize: 26, fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.5px" }}>
          SQL <span style={{ color: "#60a5fa" }}>Cheat Sheet</span>
          <span style={{ fontSize: 12, color: "#4b5563", fontWeight: 400, marginLeft: 12 }}>auf Deutsch</span>
        </h1>
        <p style={{ margin: 0, fontSize: 11, color: "#4b5563" }}>
          Klicke auf <span style={{ color: "#facc15" }}>ⓘ</span> für Erklärungen · Hover über Code zum Kopieren
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex",
        gap: 2,
        padding: "10px 28px 0",
        background: "#0c1525",
        borderBottom: "1px solid #1a2840",
        overflowX: "auto",
        flexWrap: "wrap",
      }}>
        {sections.map(s => (
          <button key={s.id} onClick={() => setActive(s.id)} style={{
            background: active === s.id ? "#111e35" : "transparent",
            border: "none",
            borderBottom: active === s.id ? `2px solid ${s.color}` : "2px solid transparent",
            color: active === s.id ? s.color : "#4b5563",
            padding: "7px 14px",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
            letterSpacing: 1,
            textTransform: "uppercase",
            transition: "all 0.15s",
            whiteSpace: "nowrap",
          }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div style={{
        flex: 1,
        padding: "20px 28px 40px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
        gap: 14,
        alignContent: "start",
      }}>
        {section.items.map((item, idx) => {
          const key = `${active}-${idx}`;
          const isOpen = expanded[key];
          return (
            <div key={idx} style={{
              background: "#0c1525",
              border: `1px solid #1a2840`,
              borderRadius: 8,
              overflow: "hidden",
              transition: "border-color 0.2s",
            }}>
              {/* Card header */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "9px 12px",
                background: "#0f1c30",
                borderBottom: "1px solid #1a2840",
                gap: 8,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 800, letterSpacing: 1.5,
                    textTransform: "uppercase", color: section.color,
                  }}>
                    {item.title}
                  </span>
                  <button onClick={() => toggleDesc(key)} title="Erklärung anzeigen" style={{
                    background: isOpen ? section.color + "22" : "none",
                    border: `1px solid ${isOpen ? section.color : "#2a3a55"}`,
                    borderRadius: 3,
                    color: isOpen ? section.color : "#4b5563",
                    fontSize: 9,
                    padding: "2px 6px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontWeight: 700,
                    letterSpacing: 1,
                    transition: "all 0.15s",
                  }}>
                    {isOpen ? "▲ WENIGER" : "ⓘ ERKL."}
                  </button>
                </div>
                <button onClick={() => copy(item.code, key)} style={{
                  background: "none",
                  border: `1px solid ${copied === key ? section.color : "#1a2840"}`,
                  borderRadius: 4,
                  color: copied === key ? section.color : "#4b5563",
                  fontSize: 9,
                  padding: "3px 8px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: 700,
                  letterSpacing: 1,
                  transition: "all 0.2s",
                  flexShrink: 0,
                }}>
                  {copied === key ? "✓ KOPIERT" : "KOPIEREN"}
                </button>
              </div>

              {/* Description (collapsible) */}
              {isOpen && (
                <div style={{
                  padding: "10px 14px",
                  background: section.color + "0d",
                  borderBottom: "1px solid #1a2840",
                  fontSize: 12,
                  lineHeight: 1.65,
                  color: "#cbd5e1",
                  fontFamily: "'Segoe UI', system-ui, sans-serif",
                  fontStyle: "normal",
                  letterSpacing: 0.1,
                }}>
                  {item.desc}
                </div>
              )}

              {/* Code */}
              <pre style={{
                margin: 0,
                padding: "12px 14px",
                fontSize: 12,
                lineHeight: 1.7,
                overflowX: "auto",
              }}>
                {highlight(item.code)}
              </pre>
            </div>
          );
        })}
      </div>

      {/* Footer legend */}
      <div style={{
        borderTop: "1px solid #1a2840",
        padding: "10px 28px",
        display: "flex",
        gap: 20,
        flexWrap: "wrap",
        alignItems: "center",
      }}>
        {[
          { label: "Schlüsselwort", col: "#60a5fa" },
          { label: "String", col: "#4ade80" },
          { label: "Zahl", col: "#fb923c" },
          { label: "Kommentar", col: "#6b7280" },
        ].map(l => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: l.col }} />
            <span style={{ fontSize: 10, color: "#374151", letterSpacing: 1, textTransform: "uppercase" }}>{l.label}</span>
          </div>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 10, color: "#1f2937" }}>8 Bereiche · {sections.reduce((a,s)=>a+s.items.length,0)} Snippets</span>
      </div>
    </div>
  );
}
