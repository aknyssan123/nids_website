import { Fragment, useMemo, useState } from "react";
import { fmt, parseReasons } from "../format.js";
import Button from "./ui/Button.jsx";
import AlertBanner from "./ui/AlertBanner.jsx";
import { SeverityBadge } from "./ui/SeverityGlyph.jsx";
import { ProbabilityBar, ReasonBars } from "./ui/charts.jsx";
import { severityOf } from "./ui/severity.js";

const PAGE = 25;
// Raw fields returned by the backend, in CSV order.
const FIELDS = ["row", "time_utc", "source", "destination", "protocol", "attack_probability", "reasons", "true_label_demo_only"];
const SEARCHABLE = ["source", "destination", "protocol", "reasons", "true_label_demo_only", "time_utc"];
// Table columns; a column is shown when at least one of its fields is present.
const COLUMNS = [
  { id: "severity", label: "Severity", fields: ["attack_probability"] },
  { id: "probability", label: "Probability", fields: ["attack_probability"] },
  { id: "flow", label: "Flow", fields: ["row", "time_utc"] },
  { id: "connection", label: "Connection", fields: ["source", "destination", "protocol"] },
  { id: "reasons", label: "Strongest reasons", fields: ["reasons"] },
  { id: "label", label: "Label in file", fields: ["true_label_demo_only"] },
];

function toCsv(rows, keys) {
  const cell = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(","), ...rows.map((r) => keys.map((k) => cell(r[k])).join(","))].join("\n");
}

const protocolText = (p) => (/^\d+$/.test(p) ? `protocol ${p}` : p);

export default function AlertsTable({ alerts, summary, runThreshold, openRow, onToggle }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const present = (k) => alerts.some((a) => a[k] != null);
  const columns = COLUMNS.filter((c) => c.fields.some(present));
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return alerts;
    return alerts.filter((a) => SEARCHABLE.some((k) => a[k] != null && String(a[k]).toLowerCase().includes(q)));
  }, [alerts, query]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(page, pages - 1);
  const rows = filtered.slice(current * PAGE, current * PAGE + PAGE);

  function download() {
    const blob = new Blob([toCsv(filtered, FIELDS.filter(present))], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alerts_${summary.model_id}_${runThreshold.toFixed(2)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="card alerts" aria-labelledby="alerts-title">
      <div className="card-head">
        <h2 id="alerts-title" className="card-title card-title-lg">Alert list</h2>
        <span className="chip-outline nd-mono" title="Alerts in this run">{fmt(summary.alerts)}</span>
      </div>

      {!alerts.length ? (
        <p className="card-body panel-text">
          No flow reached the threshold {runThreshold.toFixed(2)}. Lower the threshold and run the detector again to see
          the flows closest to it.
        </p>
      ) : (
        <div className="card-body">
          <div className="alerts-tools">
            <label className="search">
              <svg className="search-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                <circle cx="7" cy="7" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="visually-hidden">Filter alerts</span>
              <input type="search" placeholder="Filter by address, protocol, feature or label" value={query}
                     onChange={(e) => { setQuery(e.target.value); setPage(0); }} />
            </label>
            <Button size="sm" onClick={download}>Download {query ? "filtered " : ""}alerts as CSV</Button>
          </div>
          <p className="nd-caption">
            Flows at or above threshold {runThreshold.toFixed(2)}, highest probability first. Select a row to open its
            reasons.
          </p>

          {summary.alerts_truncated && (
            <AlertBanner tone="info" title="Only the highest-scoring alerts are listed">
              The list holds the {fmt(summary.alerts_returned)} highest-scoring of {fmt(summary.alerts)} alerts.
            </AlertBanner>
          )}

          <div className="table-wrap">
            <table className="data-table alert-table">
              <thead>
                <tr>{columns.map((c) => <th key={c.id} scope="col">{c.label}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((a) => {
                  const level = severityOf(a.attack_probability, runThreshold);
                  const open = a.row === openRow;
                  return (
                    <Fragment key={a.row}>
                      <tr className={open ? "alert-row is-open" : "alert-row"} tabIndex={0} aria-expanded={open}
                          onClick={() => onToggle(a.row)}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(a.row); } }}>
                        {columns.map((c) => (
                          <td key={c.id} data-label={c.label} className={`col-${c.id}`}>
                            {renderCell(c.id, a, level, runThreshold)}
                          </td>
                        ))}
                      </tr>
                      {open && (
                        <tr className="detail-row">
                          <td colSpan={columns.length}>
                            <AlertDetail alert={a} summary={summary} runThreshold={runThreshold} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && <p className="panel-text">No alert matches “{query}”.</p>}

          {pages > 1 && (
            <nav className="pager" aria-label="Alert pages">
              <Button size="sm" onClick={() => setPage(current - 1)} disabled={current === 0}>Previous</Button>
              <span className="nd-mono">
                {fmt(current * PAGE + 1)}–{fmt(Math.min(filtered.length, (current + 1) * PAGE))} of {fmt(filtered.length)}
              </span>
              <Button size="sm" onClick={() => setPage(current + 1)} disabled={current >= pages - 1}>Next</Button>
            </nav>
          )}
        </div>
      )}
    </section>
  );
}

// The dark strip under an open row: why this flow was flagged.
function AlertDetail({ alert, summary, runThreshold }) {
  const shap = summary.explanation?.startsWith("SHAP");
  const reasons = parseReasons(alert.reasons).filter((r) => Number.isFinite(r.contribution));
  return (
    <div className="detail">
      <div className="detail-facts">
        <p className="detail-title">Why this flow was flagged</p>
        {(alert.source || alert.destination) && (
          <p className="nd-mono detail-line">{alert.source ?? "?"} → {alert.destination ?? "?"}</p>
        )}
        <p className="detail-line">
          Row <span className="nd-mono">{fmt(alert.row)}</span>
          {alert.time_utc && <> · <span className="nd-mono">{alert.time_utc.replace("T", " ")}</span> UTC</>}
          {alert.protocol && <> · {protocolText(alert.protocol)}</>}
        </p>
        <ProbabilityBar value={alert.attack_probability} threshold={runThreshold} />
      </div>
      <div className="detail-reasons">
        {reasons.length ? (
          <>
            <ReasonBars reasons={reasons} />
            <p className="detail-note">
              {shap
                ? "The strongest features that pushed this flow toward attack, with their value and contribution in log-odds (TreeSHAP)."
                : "The strongest features of this flow, with their value and how much the attack probability drops when the feature takes its typical benign value."}
            </p>
          </>
        ) : (
          <p className="detail-note">
            Not explained: reasons are computed for the {fmt(summary.explained_alerts)} highest-scoring alerts.
          </p>
        )}
      </div>
    </div>
  );
}

function renderCell(id, a, level, threshold) {
  switch (id) {
    case "severity":
      return <SeverityBadge level={level} solid={level === "critical"} />;
    case "probability":
      return (
        <span title={`Attack probability ${a.attack_probability.toFixed(6)}`}>
          <ProbabilityBar value={a.attack_probability} threshold={threshold} />
        </span>
      );
    case "flow":
      return (
        <span className="cell-stack">
          <span className="nd-mono">row {fmt(a.row)}</span>
          {a.time_utc && (
            <span className="nd-caption nd-mono" title="Flow start time, UTC">{a.time_utc.replace("T", " ")} UTC</span>
          )}
        </span>
      );
    case "connection":
      return (
        <span className="cell-stack">
          <span className="nd-mono addr">{a.source ?? "?"}</span>
          <span className="nd-mono addr">→ {a.destination ?? "?"}</span>
          {a.protocol && <span className="nd-caption">{protocolText(a.protocol)}</span>}
        </span>
      );
    case "reasons": {
      const items = parseReasons(a.reasons);
      if (!items.length) return <span className="nd-caption">Not explained</span>;
      return (
        <ul className="chips">
          {items.map((r) => (
            <li key={r.feature} className="chip">
              <span className="nd-mono">{r.feature}</span>
              {r.value && <span className="chip-value nd-mono">= {r.value}</span>}
              {r.effect && <span className="chip-effect nd-mono">{r.effect}</span>}
            </li>
          ))}
        </ul>
      );
    }
    case "label": {
      const v = a.true_label_demo_only;
      if (v == null) return <span className="nd-caption">—</span>;
      return String(v).toLowerCase() === "benign"
        ? <SeverityBadge level="medium">Benign: false alarm</SeverityBadge>
        : <span className="chip chip-label">{v}</span>;
    }
    default:
      return null;
  }
}
