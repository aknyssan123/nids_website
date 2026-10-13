import { fmt, pct } from "../format.js";

export default function Summary({ live, summary, threshold, runThreshold, sampled, mismatch }) {
  const stale = threshold !== runThreshold;
  return (
    <section className="summary">
      <h2>
        {fmt(live.alerts)} {live.alerts === 1 ? "alert" : "alerts"} in {fmt(live.flows)} flows
        <span className="summary-sub"> with {summary.model} at threshold {threshold.toFixed(2)}</span>
      </h2>
      <dl className="stats">
        <div className="stat stat-alert">
          <dt>Flagged</dt>
          <dd>{pct(live.alerts, live.flows)}</dd>
          <dd className="stat-detail">of all flows</dd>
        </div>
        {live.hasLabels && (
          <>
            <div className="stat">
              <dt>Attacks caught</dt>
              <dd>{fmt(live.caught)} of {fmt(live.attacks)}</dd>
              <dd className="stat-detail">{pct(live.caught, live.attacks, 1)} of attack flows</dd>
            </div>
            <div className="stat">
              <dt>False alarms</dt>
              <dd>{fmt(live.falseAlarms)}</dd>
              <dd className="stat-detail">{pct(live.falseAlarms, live.benign)} of benign flows</dd>
            </div>
          </>
        )}
        <div className="stat">
          <dt>Flows per second</dt>
          <dd>{fmt(Math.round(summary.flows_per_second))}</dd>
          <dd className="stat-detail">scoring only; {summary.seconds_total.toFixed(2)} s with reasons</dd>
        </div>
      </dl>
      {live.hasLabels && (
        <p className="hint">Attack and false-alarm counts use the file’s Label column, which the detector never sees.</p>
      )}
      {sampled && <p className="hint">The file is large, so the counts above use an even sample of its flows.</p>}
      {mismatch && (
        <p className="note note-warn">
          These records come from a different network than the detector’s training data ({summary.trained_on}).
        </p>
      )}
      {stale && (
        <p className="note">
          You moved the threshold from {runThreshold.toFixed(2)}. The counts and the strip follow it; run the detector
          again to refresh the reasons and the alert list.
        </p>
      )}
    </section>
  );
}
