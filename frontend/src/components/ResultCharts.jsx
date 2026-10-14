import { fmt } from "../format.js";
import { ConfusionMatrix, DonutChart, Gauge } from "./ui/charts.jsx";

// Matthews correlation coefficient; 0 when a row or column of the confusion matrix is empty.
function mcc(tp, fp, fn, tn) {
  const d = Math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn));
  return d ? (tp * tn - fp * fn) / d : 0;
}

function Card({ title, chip, className = "", children }) {
  return (
    <figure className={`card chart-card ${className}`}>
      <figcaption className="card-head">
        <span className="card-title">{title}</span>
        {chip && <span className="chip-outline">{chip}</span>}
      </figcaption>
      <div className="card-body">{children}</div>
    </figure>
  );
}

// Strongest reason of each explained alert, counted per feature.
function TriggerCard({ summary }) {
  const counts = Object.entries(summary.top_reasons || {}).sort((a, b) => b[1] - a[1]);
  const max = counts.length ? counts[0][1] : 1;
  return (
    <Card title="What triggered the alerts" chip={counts.length ? `${fmt(summary.explained_alerts)} explained` : null}>
      {counts.length ? (
        <>
          <ol className="count-bars">
            {counts.map(([feature, count]) => (
              <li key={feature}>
                <span className="count-name nd-mono" title={feature}>{feature}</span>
                <span className="count-val nd-mono">{fmt(count)}</span>
                <span className="count-track" aria-hidden="true">
                  <span className="count-fill" style={{ width: `${(100 * count) / max}%` }} />
                </span>
              </li>
            ))}
          </ol>
          <p className="nd-caption">
            Strongest reason of each of the {fmt(summary.explained_alerts)} highest-scoring alerts. Method:{" "}
            {summary.explanation}.
          </p>
        </>
      ) : (
        <p className="panel-text">No alerts were explained in this run.</p>
      )}
    </Card>
  );
}

export default function ResultCharts({ live, model, summary }) {
  const { caught: tp, falseAlarms: fp, missed: fn, tn } = live;
  const segments = live.hasLabels
    ? [
        { label: "Normal, passed", value: tn, tone: "normal" },
        { label: "Attacks caught", value: tp, tone: "caught" },
        { label: "Missed attacks", value: fn, tone: "missed" },
        { label: "False alarms", value: fp, tone: "false-alarm" },
      ]
    : [
        { label: "Not alerted", value: live.flows - live.alerts, tone: "normal" },
        { label: "Alerted", value: live.alerts, tone: "attack" },
      ];
  const faRate = live.benign ? (100 * fp) / live.benign : 0;
  const study = model?.metrics;

  return (
    <div className="card-row">
      <Card title="Share of flows" chip="on this file">
        <DonutChart segments={segments} centerValue={fmt(live.flows)} centerLabel="flows"
                    ariaLabel={segments.map((s) => `${s.label}: ${fmt(s.value)}`).join(", ")} />
      </Card>

      {live.hasLabels ? (
        <>
          <Card title="Detector quality" chip="on this file">
            <div className="gauges">
              <div className="gauge-cell">
                <Gauge label="MCC" value={mcc(tp, fp, fn, tn)} min={-1} max={1} format={(v) => v.toFixed(3)} />
                {study?.mcc != null && <span className="nd-caption">In the study: {study.mcc.toFixed(4)}</span>}
              </div>
              <div className="gauge-cell">
                <Gauge label="False alarms" value={faRate} min={0} max={50} format={(v) => `${v.toFixed(2)}%`}
                       minLabel="0%" maxLabel="50%" />
                {study?.false_alarm_pct != null && (
                  <span className="nd-caption">In the study: {study.false_alarm_pct.toFixed(3)}%</span>
                )}
              </div>
            </div>
            <p className="nd-caption">
              Study values come from catalog.json (test flows of the detector’s own network).
            </p>
          </Card>

          <Card title="Alerts against labels" chip="on this file">
            <ConfusionMatrix tp={tp} fp={fp} fn={fn} tn={tn} />
          </Card>
        </>
      ) : (
        <Card title="Detector quality">
          <p className="panel-text">
            This file has no Label column, so there is nothing to compare the alerts with: the quality gauges and the
            confusion matrix are hidden.
          </p>
        </Card>
      )}

      <TriggerCard summary={summary} />
    </div>
  );
}
