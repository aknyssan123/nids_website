import { useMemo, useState } from "react";
import { fmt } from "../format.js";

const PAGE = 25;
// Raw fields returned by the backend, in CSV order.
const FIELDS = ["row", "time_utc", "source", "destination", "protocol", "attack_probability", "reasons", "true_label_demo_only"];
const SEARCHABLE = ["source", "destination", "protocol", "reasons", "true_label_demo_only", "time_utc"];
// Table columns; a column is shown when at least one of its fields is present.
const COLUMNS = [
  { id: "flow", label: "Flow", fields: ["row", "time_utc"] },
  { id: "connection", label: "Connection", fields: ["source", "destination", "protocol"] },
  { id: "probability", label: "Probability", fields: ["attack_probability"], className: "num" },
  { id: "reasons", label: "Strongest reasons", fields: ["reasons"] },
  { id: "label", label: "Label in file", fields: ["true_label_demo_only"] },
];

// "IN_BYTES=1001 (+2.31); TCP_FLAGS=22 (+0.80)" -> [{feature, value, effect}]
function parseReasons(text) {
  if (!text) return [];
  return text.split("; ").map((part) => {
    const m = part.match(/^([^=]+)=(.*) \(([+-][^)]*)\)$/);
    return m ? { feature: m[1], value: m[2], effect: m[3] } : { feature: part, value: "", effect: "" };
  });
}

function toCsv(rows, keys) {
  const cell = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(","), ...rows.map((r) => keys.map((k) => cell(r[k])).join(","))].join("\n");
}

export default function AlertsTable({ alerts, summary, runThreshold }) {
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
  const shap = summary.explanation?.startsWith("SHAP");

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

  if (!alerts.length) {
    return (
      <section className="alerts">
        <h2>Alert list</h2>
        <p className="empty-note">
          No flow reached the threshold {runThreshold.toFixed(2)}. Lower the threshold and run the detector again to see
          the flows closest to it.
        </p>
      </section>
    );
  }

  return (
    <section className="alerts">
      <div className="alerts-head">
        <div>
          <h2>Alert list</h2>
          <p className="hint">
            Flows at or above threshold {runThreshold.toFixed(2)}, highest probability first.
            {shap
              ? " Each reason shows the feature value and how far it pushed the score toward attack (log-odds)."
              : " Each reason shows the feature value and how much the attack probability drops if that feature takes its typical benign value."}
          </p>
        </div>
        <div className="alerts-tools">
          <label className="search">
            <span className="visually-hidden">Filter alerts</span>
            <input type="search" placeholder="Filter by address, protocol, feature or label" value={query}
                   onChange={(e) => { setQuery(e.target.value); setPage(0); }} />
          </label>
          <button type="button" className="secondary" onClick={download}>
            Download {query ? "filtered " : ""}alerts as CSV
          </button>
        </div>
      </div>

      {summary.alerts_truncated && (
        <p className="note">
          The list holds the {fmt(summary.alerts_returned)} highest-scoring of {fmt(summary.alerts)} alerts.
        </p>
      )}

      <div className="table-wrap" tabIndex={0} role="region" aria-label="Alert list">
        <table className="alert-table">
          <thead>
            <tr>
              {columns.map((c) => <th key={c.id} scope="col" className={c.className}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.row}>
                {columns.map((c) => <td key={c.id} className={c.className}>{renderCell(c.id, a, summary)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && <p className="empty-note">No alert matches “{query}”.</p>}

      {pages > 1 && (
        <nav className="pager" aria-label="Alert pages">
          <button type="button" className="secondary" onClick={() => setPage(current - 1)} disabled={current === 0}>
            Previous
          </button>
          <span>
            {fmt(current * PAGE + 1)}–{fmt(Math.min(filtered.length, (current + 1) * PAGE))} of {fmt(filtered.length)}
          </span>
          <button type="button" className="secondary" onClick={() => setPage(current + 1)} disabled={current >= pages - 1}>
            Next
          </button>
        </nav>
      )}
    </section>
  );
}

function renderCell(id, a, summary) {
  switch (id) {
    case "flow":
      return (
        <span className="cell-stack">
          <span>Row {fmt(a.row)}</span>
          {a.time_utc && (
            <span className="cell-sub nowrap" title="Flow start time, UTC">
              {a.time_utc.slice(0, 10)}<br />{a.time_utc.slice(11)} UTC
            </span>
          )}
        </span>
      );
    case "connection":
      return (
        <span className="cell-stack">
          <span className="nowrap">
            <code className="addr">{a.source ?? "?"}</code>
            {a.protocol && (
              <span className="cell-sub"> over {/^\d+$/.test(a.protocol) ? `protocol ${a.protocol}` : a.protocol}</span>
            )}
          </span>
          <span className="cell-sub nowrap">to <code className="addr">{a.destination ?? "?"}</code></span>
        </span>
      );
    case "probability":
      return (
        <span className="prob">
          <span className="prob-value">{a.attack_probability.toFixed(4)}</span>
          <span className="prob-track" aria-hidden="true">
            <span className="prob-fill" style={{ width: `${a.attack_probability * 100}%` }} />
          </span>
        </span>
      );
    case "reasons": {
      const items = parseReasons(a.reasons);
      if (!items.length) {
        return (
          <span className="muted">
            Not explained: reasons are computed for the {fmt(summary.explained_alerts)} highest-scoring alerts
          </span>
        );
      }
      return (
        <ul className="chips">
          {items.map((r) => (
            <li key={r.feature} className="chip">
              <code>{r.feature}</code>
              {r.value && <span className="chip-value">= {r.value}</span>}
              {r.effect && <span className="chip-effect">{r.effect}</span>}
            </li>
          ))}
        </ul>
      );
    }
    case "label": {
      const v = a.true_label_demo_only;
      if (v == null) return "";
      return String(v).toLowerCase() === "benign"
        ? <span className="label-benign">Benign: false alarm</span>
        : <span className="label-attack">{v}</span>;
    }
    default:
      return null;
  }
}
