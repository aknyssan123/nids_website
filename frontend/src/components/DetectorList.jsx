import { networkShort } from "../format.js";

// Detectors grouped by the dataset they were trained on.
export default function DetectorList({ models, value, onChange }) {
  const groups = [...new Set(models.map((m) => m.trained_on))];
  return (
    <div className="detectors">
      {groups.map((net) => (
        <fieldset key={net} className="detector-group">
          <legend>Trained on {networkShort(net)}</legend>
          {models.filter((m) => m.trained_on === net).map((m) => (
            <label key={m.id} className={m.id === value ? "detector is-selected" : "detector"}>
              <input type="radio" name="detector" value={m.id} checked={m.id === value} onChange={() => onChange(m.id)} />
              <span className="detector-name">{m.family}</span>
              <span className="detector-score" title="Matthews correlation coefficient on held-out test flows (1 = perfect)">
                MCC {m.metrics?.mcc != null ? m.metrics.mcc.toFixed(3) : "–"}
              </span>
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  );
}
