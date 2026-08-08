import React, { useState } from "react";

// ── Sample data ────────────────────────────────────────────────
const KUNDEN = [
  { id: 1, name: "Anna Meier",   stadt: "Berlin" },
  { id: 2, name: "Ben Schulz",  stadt: "Hamburg" },
  { id: 3, name: "Clara Vogel", stadt: "München" },
  { id: 4, name: "Dirk Braun",  stadt: "Köln" },
];

const BESTELLUNGEN = [
  { id: 101, kunden_id: 1, produkt: "Laptop",   betrag: 999 },
  { id: 102, kunden_id: 2, produkt: "Maus",      betrag: 29  },
  { id: 103, kunden_id: 1, produkt: "Tastatur",  betrag: 79  },
  { id: 104, kunden_id: 5, produkt: "Monitor",   betrag: 349 },
  { id: 105, kunden_id: 3, produkt: "Headset",   betrag: 149 },
];

const MITARBEITER = [
  { id: 1, name: "Maria Koch", vorgesetzter_id: null },
  { id: 2, name: "Tom Bauer", vorgesetzter_id: 1 },
  { id: 3, name: "Lisa Kraft", vorgesetzter_id: 2 },
  { id: 4, name: "Jan Müller", vorgesetzter_id: 2 },
];

// ── Join logic ─────────────────────────────────────────────────
function joinRow(kunde, bestellung, flags = {}) {
  return {
    customerId: kunde?.id ?? null,
    name: kunde?.name ?? null,
    stadt: kunde?.stadt ?? null,
    orderId: bestellung?.id ?? null,
    kundenId: bestellung?.kunden_id ?? null,
    produkt: bestellung?.produkt ?? null,
    betrag: bestellung?.betrag ?? null,
    match: Boolean(kunde && bestellung),
    ...flags,
  };
}

function applyJoin(type) {
  const rows = [];
  if (type === "inner") {
    for (const b of BESTELLUNGEN) {
      const k = KUNDEN.find(k => k.id === b.kunden_id);
      if (k) rows.push(joinRow(k, b));
    }
  } else if (type === "left") {
    for (const k of KUNDEN) {
      const bs = BESTELLUNGEN.filter(b => b.kunden_id === k.id);
      if (bs.length) bs.forEach(b => rows.push(joinRow(k, b)));
      else rows.push(joinRow(k, null, { noRight: true }));
    }
  } else if (type === "right") {
    for (const b of BESTELLUNGEN) {
      const k = KUNDEN.find(k => k.id === b.kunden_id);
      if (k) rows.push(joinRow(k, b));
      else rows.push(joinRow(null, b, { noLeft: true }));
    }
  } else if (type === "full") {
    const matched = new Set();
    for (const k of KUNDEN) {
      const bs = BESTELLUNGEN.filter(b => b.kunden_id === k.id);
      if (bs.length) bs.forEach(b => { rows.push(joinRow(k, b)); matched.add(b.id); });
      else rows.push(joinRow(k, null, { noRight: true }));
    }
    for (const b of BESTELLUNGEN) {
      if (!matched.has(b.id)) rows.push(joinRow(null, b, { noLeft: true }));
    }
  } else if (type === "cross") {
    for (const k of KUNDEN) for (const b of BESTELLUNGEN)
      rows.push(joinRow(k, b));
  } else if (type === "self") {
    return MITARBEITER.map(m => ({
      mitarbeiter: m.name,
      vorgesetzter: MITARBEITER.find(v => v.id === m.vorgesetzter_id)?.name ?? "—",
    }));
  }
  return rows;
}

// ── Venn SVG ──────────────────────────────────────────────────
function VennDiagram({ type }) {
  const cfg = {
    inner: { leftFill: "#1e3a5f", rightFill: "#1e3a5f", midFill: "#3b82f6", leftOp: 0.3, rightOp: 0.3, midOp: 1 },
    left:  { leftFill: "#3b82f6", rightFill: "#1e3a5f", midFill: "#3b82f6", leftOp: 1,   rightOp: 0.25, midOp: 1 },
    right: { leftFill: "#1e3a5f", rightFill: "#3b82f6", midFill: "#3b82f6", leftOp: 0.25, rightOp: 1,  midOp: 1 },
    full:  { leftFill: "#3b82f6", rightFill: "#3b82f6", midFill: "#3b82f6", leftOp: 1,   rightOp: 1,   midOp: 1 },
    cross: { leftFill: "#f59e0b", rightFill: "#f59e0b", midFill: "#f59e0b", leftOp: 1,   rightOp: 1,   midOp: 1 },
    self:  { leftFill: "#a78bfa", rightFill: "#a78bfa", midFill: "#a78bfa", leftOp: 1,   rightOp: 0.3, midOp: 0.7 },
  }[type] || {};
  if (type === "cross") return (
    <svg viewBox="0 0 120 70" width="120" height="70" aria-hidden="true" focusable="false">
      <rect x="5" y="10" width="50" height="50" rx="4" fill="#f59e0b" opacity="0.25" stroke="#f59e0b" strokeWidth="1.5"/>
      <rect x="65" y="10" width="50" height="50" rx="4" fill="#f59e0b" opacity="0.25" stroke="#f59e0b" strokeWidth="1.5"/>
      {[0,1,2].map(i => [0,1,2].map(j => (
        <line key={`${i}${j}`} x1={30} y1={35} x2={90} y2={35} stroke="#f59e0b" strokeWidth="0.8" opacity="0.5"
          style={{ transform: `translate(${(i-1)*10}px,${(j-1)*10}px)` }}/>
      )))}
      <text x="30" y="38" textAnchor="middle" fill="#f59e0b" fontSize="8" fontWeight="bold">A</text>
      <text x="90" y="38" textAnchor="middle" fill="#f59e0b" fontSize="8" fontWeight="bold">B</text>
      <text x="60" y="68" textAnchor="middle" fill="#6b7280" fontSize="7">jede × jede</text>
    </svg>
  );
  return (
    <svg viewBox="0 0 120 70" width="120" height="70" aria-hidden="true" focusable="false">
      <ellipse cx="43" cy="35" rx="33" ry="26" fill={cfg.leftFill} opacity={cfg.leftOp * 0.35} stroke={cfg.leftFill} strokeWidth="1.5" strokeOpacity={cfg.leftOp}/>
      <ellipse cx="77" cy="35" rx="33" ry="26" fill={cfg.rightFill} opacity={cfg.rightOp * 0.35} stroke={cfg.rightFill} strokeWidth="1.5" strokeOpacity={cfg.rightOp}/>
      <ellipse cx="60" cy="35" rx="13" ry="21" fill={cfg.midFill} opacity={cfg.midOp * 0.45}/>
      <text x="27" y="38" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" opacity={cfg.leftOp}>A</text>
      <text x="93" y="38" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" opacity={cfg.rightOp}>B</text>
    </svg>
  );
}

// ── Code highlight ─────────────────────────────────────────────
const KWS = ["SELECT","FROM","INNER","LEFT","RIGHT","FULL","OUTER","JOIN","ON","WHERE","IS NULL","CROSS","AS","AND","OR","NOT","NULL","USING","NATURAL"];
const SORTED_KWS = [...KWS].sort((a, b) => b.length - a.length);
function hl(code) {
  return code.split("\n").map((line, li) => {
    if (line.trim().startsWith("--")) return <span key={li} style={{display:"block",color:"#94a3b8",fontStyle:"italic"}}>{line||" "}</span>;
    const parts = []; let i = 0;
    while (i < line.length) {
      let m = false;
      for (const kw of SORTED_KWS) {
        if (line.slice(i).toUpperCase().startsWith(kw) && (i === 0 || /[\s,(=!<>]/.test(line[i - 1]))) {
          const after = line[i+kw.length];
          if (!after || /[\s;,()\n]/.test(after)) {
            parts.push(<span key={i} style={{color:"#60a5fa",fontWeight:700}}>{line.slice(i,i+kw.length)}</span>);
            i+=kw.length; m=true; break;
          }
        }
      }
      if (!m) {
        if (line[i]==="-"&&line[i+1]==="-") {
          parts.push(<span key={i} style={{color:"#94a3b8",fontStyle:"italic"}}>{line.slice(i)}</span>); break;
        } else if (line[i]==="'") {
          let j=i+1;
          while(j<line.length){
            if(line[j]==="'"&&line[j+1]==="'"){j+=2;continue;}
            if(line[j]==="'"){j++;break;}
            j++;
          }
          parts.push(<span key={i} style={{color:"#4ade80"}}>{line.slice(i,j)}</span>); i=j;
        }
        else { parts.push(<span key={i} style={{color:"#e2e8f0"}}>{line[i]}</span>); i++; }
      }
    }
    return <span key={li} style={{display:"block",minHeight:"1.65em"}}>{parts.length?parts:" "}</span>;
  });
}

// ── Join definitions ───────────────────────────────────────────
const JOINS = [
  {
    id: "inner",
    label: "INNER JOIN",
    color: "#3b82f6",
    emoji: "🔵",
    kurz: "Nur übereinstimmende Zeilen",
    erklaerung: `INNER JOIN gibt nur die Zeilen zurück, bei denen in BEIDEN Tabellen ein passender Wert gefunden wird. Zeilen ohne Partner auf einer der Seiten werden komplett weggelassen. Das ist der häufigste Join-Typ.`,
    wann: "Immer dann, wenn du nur vollständige Datensätze willst – z.B. Kunden MIT Bestellungen.",
    code: `SELECT k.id, k.name, k.stadt,
       b.id AS bestell_id,
       b.produkt, b.betrag
FROM kunden k
INNER JOIN bestellungen b
  ON k.id = b.kunden_id;`,
    resultType: "inner",
  },
  {
    id: "left",
    label: "LEFT JOIN",
    color: "#4ade80",
    emoji: "🟢",
    kurz: "Alle Zeilen der linken Tabelle",
    erklaerung: `LEFT JOIN gibt ALLE Zeilen der linken Tabelle zurück – egal ob ein passender Eintrag in der rechten Tabelle existiert. Fehlt ein Partner, werden die Spalten der rechten Tabelle mit NULL aufgefüllt.`,
    wann: "Wenn du alle Kunden sehen willst – auch die ohne Bestellung. NULL-Einträge zeigen dann 'kein Match'.",
    code: `SELECT k.id, k.name, k.stadt,
       b.id AS bestell_id,
       b.produkt, b.betrag
FROM kunden k
LEFT JOIN bestellungen b
  ON k.id = b.kunden_id;

-- Nur Kunden OHNE Bestellung:
-- WHERE b.id IS NULL`,
    resultType: "left",
  },
  {
    id: "right",
    label: "RIGHT JOIN",
    color: "#f472b6",
    emoji: "🟣",
    kurz: "Alle Zeilen der rechten Tabelle",
    erklaerung: `RIGHT JOIN ist das Spiegelbild des LEFT JOIN: alle Zeilen der rechten Tabelle bleiben erhalten. In der Praxis wird RIGHT JOIN selten genutzt – man schreibt es meist als LEFT JOIN mit vertauschten Tabellen um.`,
    wann: "Wenn du alle Bestellungen sehen willst – auch die, deren kunden_id in der Kundentabelle nicht existiert (z.B. gelöschte Kunden).",
    code: `SELECT k.id, k.name,
       b.id AS bestell_id,
       b.kunden_id, b.produkt
FROM kunden k
RIGHT JOIN bestellungen b
  ON k.id = b.kunden_id;

-- Equivalent als LEFT JOIN:
-- FROM bestellungen b
-- LEFT JOIN kunden k ON k.id = b.kunden_id`,
    resultType: "right",
  },
  {
    id: "full",
    label: "FULL OUTER JOIN",
    color: "#fb923c",
    emoji: "🟠",
    kurz: "Alle Zeilen beider Tabellen",
    erklaerung: `FULL OUTER JOIN kombiniert LEFT und RIGHT JOIN: alle Zeilen beider Tabellen erscheinen im Ergebnis. Fehlt ein Partner, werden die Spalten der jeweiligen Seite mit NULL gefüllt. In MySQL nicht direkt verfügbar – dort UNION verwenden.`,
    wann: "Für vollständige Abgleiche, z.B. Daten-Synchronisation oder Lückenanalyse zwischen zwei Datenquellen.",
    code: `-- PostgreSQL / SQL Server:
SELECT k.id, k.name,
       b.id AS bestell_id, b.produkt
FROM kunden k
FULL OUTER JOIN bestellungen b
  ON k.id = b.kunden_id;

-- MySQL-Alternative (UNION):
SELECT k.id, k.name, b.id, b.produkt
FROM kunden k LEFT JOIN bestellungen b ON k.id = b.kunden_id
UNION
SELECT k.id, k.name, b.id, b.produkt
FROM kunden k RIGHT JOIN bestellungen b ON k.id = b.kunden_id;`,
    resultType: "full",
  },
  {
    id: "cross",
    label: "CROSS JOIN",
    color: "#facc15",
    emoji: "🟡",
    kurz: "Jede Zeile × jede Zeile (Kreuzprodukt)",
    erklaerung: `CROSS JOIN kombiniert jede Zeile der linken mit jeder Zeile der rechten Tabelle – ohne JOIN-Bedingung. Bei 4 Kunden und 5 Bestellungen entstehen 4 × 5 = 20 Zeilen. Vorsicht: bei großen Tabellen explodiert die Ergebnismenge!`,
    wann: "Für Kombinatorik – z.B. alle möglichen Produktkombinationen, Terminkalender-Slots oder Test-Datensätze.",
    code: `SELECT k.name, b.produkt
FROM kunden k
CROSS JOIN bestellungen b;

-- Gleichbedeutend (ältere Syntax):
SELECT k.name, b.produkt
FROM kunden k, bestellungen b;`,
    resultType: "cross",
  },
  {
    id: "self",
    label: "SELF JOIN",
    color: "#a78bfa",
    emoji: "🟤",
    kurz: "Tabelle mit sich selbst verbinden",
    erklaerung: `Ein SELF JOIN verbindet eine Tabelle mit sich selbst. Die Tabelle wird dabei zweimal referenziert – mit zwei verschiedenen Aliasnamen. Typisch für Hierarchien: Mitarbeiter→Vorgesetzter, Kategorie→Oberkategorie, Stücklisten.`,
    wann: "Immer wenn eine Zeile auf eine andere Zeile in derselben Tabelle verweist (parent_id, manager_id, vorgaenger_id).",
    code: `-- Mitarbeiter-Tabelle mit Selbstverweis:
-- id | name          | vorgesetzter_id
-- ---|---------------|----------------
-- 1  | Maria Koch    | NULL   (CEO)
-- 2  | Tom Bauer     | 1      (→ Maria)
-- 3  | Lisa Kraft    | 2      (→ Tom)
-- 4  | Jan Müller    | 2      (→ Tom)

SELECT m.name        AS mitarbeiter,
       v.name        AS vorgesetzter
FROM mitarbeiter m
LEFT JOIN mitarbeiter v
  ON m.vorgesetzter_id = v.id
ORDER BY v.name;`,
    resultType: "self",
  },
];

// ── Result table ───────────────────────────────────────────────
function ResultTable({ type }) {
  if (type === "self") {
    const selfData = applyJoin("self");
    return (
      <table style={tStyle}>
        <caption style={visuallyHidden}>Ergebnis des Self Joins</caption>
        <thead><tr>
          {["mitarbeiter","vorgesetzter"].map(h => <th key={h} style={thStyle}>{h}</th>)}
        </tr></thead>
        <tbody>{selfData.map((r,i) => (
          <tr key={r.mitarbeiter} style={{background: i%2===0?"#0c1525":"#0a1020"}}>
            <td style={tdStyle}>{r.mitarbeiter}</td>
            <td style={{...tdStyle, color: r.vorgesetzter==="—"?"#6b7280":"#e2e8f0"}}>{r.vorgesetzter}</td>
          </tr>
        ))}</tbody>
      </table>
    );
  }
  const rows = applyJoin(type);
  if (!rows) return null;
  return (
    <table style={tStyle}>
      <caption style={visuallyHidden}>Ergebnis des ausgewählten Join-Typs</caption>
      <thead><tr>
        {["k.id","k.name","k.stadt","b.id","b.produkt","b.betrag"].map(h => (
          <th key={h} style={thStyle}>{h}</th>
        ))}
      </tr></thead>
      <tbody>{rows.map((r,i) => {
        const nullRow = r.noRight || r.noLeft;
        return (
          <tr key={`${r.customerId ?? "null"}-${r.orderId ?? "null"}`} style={{background: nullRow ? "#1a0e0e" : i%2===0 ? "#0c1525" : "#0a1020"}}>
            <td style={{...tdStyle, color: r.customerId==null?"#f87171":"#e2e8f0"}}>{r.customerId ?? "NULL"}</td>
            <td style={{...tdStyle, color: r.name==null?"#ef4444":"#e2e8f0"}}>{r.name ?? "NULL"}</td>
            <td style={{...tdStyle, color: r.stadt==null?"#ef4444":"#6b7280"}}>{r.stadt ?? "NULL"}</td>
            <td style={{...tdStyle, color: r.orderId==null?"#f87171":"#e2e8f0"}}>{r.orderId ?? "NULL"}</td>
            <td style={{...tdStyle, color: r.produkt==null?"#ef4444":"#4ade80"}}>{r.produkt ?? "NULL"}</td>
            <td style={{...tdStyle, color: r.betrag==null?"#ef4444":"#fb923c"}}>{r.betrag != null ? `${r.betrag} €` : "NULL"}</td>
          </tr>
        );
      })}</tbody>
    </table>
  );
}

const tStyle = { width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" };
const thStyle = { padding: "6px 10px", textAlign: "left", color: "#94a3b8", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", borderBottom: "1px solid #1a2840", fontWeight: 700, background: "#0a1020" };
const tdStyle = { padding: "5px 10px", borderBottom: "1px solid #0f1c30", whiteSpace: "nowrap" };
const visuallyHidden = { position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0 };

// ── Source tables ──────────────────────────────────────────────
function SourceTables({ color, type }) {
  if (type === "self") {
    return (
      <div style={{ overflowX: "auto" }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color, textTransform: "uppercase", marginBottom: 6 }}>
          📋 mitarbeiter
        </div>
        <table style={tStyle}>
          <caption style={visuallyHidden}>Ausgangsdaten der Tabelle mitarbeiter</caption>
          <thead><tr>{["id","name","vorgesetzter_id"].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
          <tbody>{MITARBEITER.map((m,i)=>(
            <tr key={m.id} style={{background:i%2===0?"#0c1525":"#0a1020"}}>
              <td style={{...tdStyle,color,fontWeight:700}}>{m.id}</td>
              <td style={tdStyle}>{m.name}</td>
              <td style={{...tdStyle,color:m.vorgesetzter_id==null?"#f87171":"#94a3b8"}}>{m.vorgesetzter_id ?? "NULL"}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      {/* kunden */}
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color, textTransform: "uppercase", marginBottom: 6 }}>
          📋 kunden
        </div>
        <table style={tStyle}>
          <caption style={visuallyHidden}>Ausgangsdaten der Tabelle kunden</caption>
          <thead><tr>{["id","name","stadt"].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
          <tbody>{KUNDEN.map((k,i)=>(
            <tr key={k.id} style={{background:i%2===0?"#0c1525":"#0a1020"}}>
              <td style={{...tdStyle,color:color,fontWeight:700}}>{k.id}</td>
              <td style={tdStyle}>{k.name}</td>
              <td style={{...tdStyle,color:"#6b7280"}}>{k.stadt}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {/* bestellungen */}
      <div style={{ flex: 1, minWidth: 240 }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color, textTransform: "uppercase", marginBottom: 6 }}>
          📋 bestellungen
        </div>
        <table style={tStyle}>
          <caption style={visuallyHidden}>Ausgangsdaten der Tabelle bestellungen</caption>
          <thead><tr>{["id","kunden_id","produkt","betrag"].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
          <tbody>{BESTELLUNGEN.map((b,i)=>{
            const hasMatch = KUNDEN.some(k=>k.id===b.kunden_id);
            return (
              <tr key={b.id} style={{background:i%2===0?"#0c1525":"#0a1020"}}>
                <td style={{...tdStyle,color:"#6b7280"}}>{b.id}</td>
                <td style={{...tdStyle,color:hasMatch?color:"#ef4444",fontWeight:700}}>{b.kunden_id}{!hasMatch&&<span style={{fontSize:9,marginLeft:4,color:"#ef4444"}}>⚠ kein Match</span>}</td>
                <td style={{...tdStyle,color:"#4ade80"}}>{b.produkt}</td>
                <td style={{...tdStyle,color:"#fb923c"}}>{b.betrag} €</td>
              </tr>
            );
          })}</tbody>
        </table>
        <div style={{fontSize:10,color:"#374151",marginTop:4}}>
          ⚠ kunden_id 5 existiert nicht in kunden
        </div>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────
export default function SQLJoins() {
  const [active, setActive] = useState("inner");
  const [tab, setTab] = useState("result"); // result | code | tables
  const join = JOINS.find(j => j.id === active);
  const resultDescription = active === "cross"
    ? "kunden CROSS JOIN bestellungen"
    : active === "self"
      ? "mitarbeiter m LEFT JOIN mitarbeiter v ON m.vorgesetzter_id = v.id"
      : `kunden ${join.label} bestellungen ON kunden.id = bestellungen.kunden_id`;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#070c16",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      color: "#e2e8f0",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <header style={{ padding: "22px clamp(14px, 4vw, 28px) 14px", borderBottom: "1px solid #24344f", background: "#09111f" }}>
        <div style={{ fontSize: 10, color: "#60a5fa", letterSpacing: 4, textTransform: "uppercase", fontWeight: 700 }}>SQL · Visuell</div>
        <h1 style={{ margin: "4px 0 2px", fontSize: 24, fontWeight: 800, color: "#f8fafc" }}>
          JOIN-Typen <span style={{ color: join.color, transition: "color 0.3s" }}>erklärt</span>
        </h1>
        <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>
          Interaktiv · Mit Beispieldaten · Auf Deutsch
        </p>
      </header>

      {/* Join selector */}
      <nav aria-label="Join-Typ auswählen" style={{
        display: "flex", gap: 8, padding: "14px clamp(14px, 4vw, 28px)",
        background: "#09111f", borderBottom: "1px solid #131f35",
        overflowX: "auto", flexWrap: "wrap",
      }}>
        {JOINS.map(j => (
          <button type="button" key={j.id} aria-pressed={active === j.id} onClick={() => { setActive(j.id); setTab("result"); }} style={{
            background: active === j.id ? j.color + "18" : "transparent",
            border: `1.5px solid ${active === j.id ? j.color : "#1a2840"}`,
            borderRadius: 6,
            color: active === j.id ? j.color : "#94a3b8",
            padding: "7px 14px",
            fontSize: 11, fontWeight: 700, cursor: "pointer",
            fontFamily: "inherit", letterSpacing: 0.5,
            transition: "all 0.15s", whiteSpace: "nowrap",
          }}>
            {j.emoji} {j.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main style={{ flex: 1, padding: "20px clamp(14px, 4vw, 28px) 40px", maxWidth: 1100, width: "100%", margin: "0 auto", minWidth: 0 }}>

        {/* Top row: Venn + explanation */}
        <div style={{ display: "flex", gap: 20, marginBottom: 20, flexWrap: "wrap" }}>
          {/* Venn */}
          <div style={{
            background: "#0c1525", border: `1px solid ${join.color}33`,
            borderRadius: 10, padding: "18px 20px",
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 8, minWidth: 160,
          }}>
            <VennDiagram type={active} />
            <div style={{ fontSize: 10, color: join.color, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", textAlign: "center" }}>
              {join.kurz}
            </div>
          </div>

          {/* Explanation */}
          <div style={{
            flex: 1, background: "#0c1525",
            border: `1px solid ${join.color}33`,
            borderRadius: 10, padding: "18px 20px",
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: join.color, fontFamily: "inherit" }}>
              {join.emoji} {join.label}
            </h2>
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.7, color: "#cbd5e1", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
              {join.erklaerung}
            </p>
            <div style={{
              background: join.color + "10", border: `1px solid ${join.color}33`,
              borderRadius: 6, padding: "8px 12px",
              fontSize: 11.5, color: "#94a3b8",
              fontFamily: "'Segoe UI', system-ui, sans-serif", lineHeight: 1.6,
            }}>
              <span style={{ color: join.color, fontWeight: 700 }}>✦ Wann nutzen? </span>
              {join.wann}
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div role="tablist" aria-label="Darstellung" style={{ display: "flex", gap: 2, marginBottom: 0, borderBottom: "1px solid #131f35", overflowX: "auto" }}>
          {[
            { id: "result", label: "▤ Ergebnis-Tabelle" },
            { id: "code",   label: "</> SQL-Code" },
            { id: "tables", label: "📋 Ausgangsdaten" },
          ].map(t => (
            <button type="button" key={t.id} id={`join-tab-${t.id}`} role="tab" aria-selected={tab === t.id} aria-controls="join-tab-panel" onClick={() => setTab(t.id)} style={{
              background: tab === t.id ? "#0c1525" : "transparent",
              border: "none",
              borderBottom: tab === t.id ? `2px solid ${join.color}` : "2px solid transparent",
              color: tab === t.id ? join.color : "#94a3b8",
              padding: "8px 16px", fontSize: 11, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
              letterSpacing: 0.5, transition: "all 0.15s",
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div id="join-tab-panel" role="tabpanel" aria-labelledby={`join-tab-${tab}`} style={{
          background: "#0c1525", border: "1px solid #131f35", borderTop: "none",
          borderRadius: "0 0 10px 10px", overflow: "hidden",
        }}>
          {tab === "result" && (
            <div style={{ overflowX: "auto", padding: "4px 0" }}>
              <div style={{ padding: "10px 16px 4px", fontSize: 10, color: "#4b5563", letterSpacing: 1, textTransform: "uppercase" }}>
                Ergebnis von: {resultDescription}
                {(() => {
                  const rows = applyJoin(active);
                  return <span style={{ marginLeft: 12, color: join.color }}>{rows?.length} Zeilen</span>;
                })()}
              </div>
              {active !== "self" && (
                <div style={{ padding: "4px 16px 8px", fontSize: 10.5, color: "#6b7280", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
                  <span style={{ color: "#ef4444" }}>NULL</span> = kein passender Eintrag in der anderen Tabelle
                </div>
              )}
              <ResultTable type={active} />
            </div>
          )}
          {tab === "code" && (
            <pre tabIndex={0} aria-label={`SQL-Beispiel: ${join.label}`} style={{ margin: 0, padding: "16px 18px", fontSize: 12.5, lineHeight: 1.75, overflowX: "auto" }}>
              <code>{hl(join.code)}</code>
            </pre>
          )}
          {tab === "tables" && (
            <div style={{ padding: "16px 18px" }}>
              <SourceTables color={join.color} type={active} />
            </div>
          )}
        </div>

        {/* Join cheatsheet overview */}
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
            Übersicht aller Join-Typen
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
            {JOINS.map(j => (
              <button type="button" key={j.id} aria-pressed={active === j.id} onClick={() => { setActive(j.id); setTab("result"); }} style={{
                background: active === j.id ? j.color + "18" : "#0c1525",
                border: `1px solid ${active === j.id ? j.color : "#131f35"}`,
                borderRadius: 6, padding: "10px 12px", cursor: "pointer",
                textAlign: "left", fontFamily: "inherit", transition: "all 0.15s",
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: j.color, marginBottom: 3 }}>{j.emoji} {j.label}</div>
                <div style={{ fontSize: 10, color: "#94a3b8", lineHeight: 1.4 }}>{j.kurz}</div>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export { applyJoin, BESTELLUNGEN, JOINS, KUNDEN, MITARBEITER };
