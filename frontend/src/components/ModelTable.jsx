import { networkShort } from "../format.js";

const num = (v, digits) => (v == null ? "–" : v.toFixed(digits));

// Reference table: the numbers come from the study's experiments (catalog.json), not from this page.
export default function ModelTable({ models }) {
  const sources = [...new Set(models.map((m) => m.metrics?.source).filter(Boolean))];
  return (
    <section className="card reference" aria-labelledby="reference-title">
      <div className="card-head">
        <h2 id="reference-title" className="card-title card-title-lg">The detectors</h2>
        <span className="chip-outline">from catalog.json</span>
      </div>
      <div className="card-body">
        <p className="panel-text">
          Test results from the study, on flows held out from training. Each detector is tested on its own network only;
          the cross-network experiment showed that none of them transfers to the other network.
        </p>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Detector</th>
                <th scope="col">Trained on</th>
                <th scope="col" className="num">MCC</th>
                <th scope="col" className="num">False alarms</th>
                <th scope="col" className="num">Missed attacks</th>
                <th scope="col" className="num">Runs</th>
                <th scope="col" className="num">Time per flow</th>
                <th scope="col" className="num">Size</th>
                <th scope="col">Reasons by</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.id}>
                  <th scope="row" data-label="Detector">{m.family}</th>
                  <td data-label="Trained on"><span className="chip">{networkShort(m.trained_on)}</span></td>
                  <td data-label="MCC" className="num nd-mono">{num(m.metrics?.mcc, 4)}</td>
                  <td data-label="False alarms" className="num nd-mono">
                    {m.metrics?.false_alarm_pct != null ? `${num(m.metrics.false_alarm_pct, 3)}%` : "–"}
                  </td>
                  <td data-label="Missed attacks" className="num nd-mono">
                    {m.metrics?.missed_attack_pct != null ? `${num(m.metrics.missed_attack_pct, 3)}%` : "–"}
                  </td>
                  <td data-label="Runs" className="num nd-mono">{m.metrics?.seeds ?? "–"}</td>
                  <td data-label="Time per flow" className="num nd-mono">
                    {m.speed?.batch_us_per_flow_1thread != null
                      ? `${num(m.speed.batch_us_per_flow_1thread, 2)} µs`
                      : <span className="nd-caption">not measured</span>}
                  </td>
                  <td data-label="Size" className="num nd-mono">{m.size_mb != null ? `${num(m.size_mb, 2)} MB` : "–"}</td>
                  <td data-label="Reasons by">{m.explanation_label?.startsWith("SHAP") ? "SHAP (TreeSHAP)" : "Feature replacement"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="nd-caption">
          MCC: Matthews correlation coefficient, 1 is perfect. False alarms: share of benign flows flagged. Missed attacks:
          share of attack flows not flagged. Runs: training runs with different random seeds that the averages cover. Time
          per flow: batch prediction on one CPU thread, measured in Colab.
          {sources.length > 0 && ` Sources: ${sources.join("; ")}.`}
        </p>
      </div>
    </section>
  );
}
