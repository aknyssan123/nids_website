import { networkShort } from "../format.js";

const num = (v, digits) => (v == null ? "–" : v.toFixed(digits));

// Reference table: the numbers come from the study's experiments (catalog.json), not from this page.
export default function ModelTable({ models }) {
  const sources = [...new Set(models.map((m) => m.metrics?.source).filter(Boolean))];
  return (
    <section className="reference" aria-labelledby="reference-title">
      <h2 id="reference-title">The detectors</h2>
      <p className="hint">
        Test results from the study, on flows held out from training. Each detector is tested on its own network only;
        the cross-network experiment showed that none of them transfers to the other network.
      </p>
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Detector comparison">
        <table>
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
                <th scope="row">{m.family}</th>
                <td>{networkShort(m.trained_on)}</td>
                <td className="num">{num(m.metrics?.mcc, 4)}</td>
                <td className="num">{m.metrics?.false_alarm_pct != null ? `${num(m.metrics.false_alarm_pct, 3)}%` : "–"}</td>
                <td className="num">{m.metrics?.missed_attack_pct != null ? `${num(m.metrics.missed_attack_pct, 3)}%` : "–"}</td>
                <td className="num">{m.metrics?.seeds ?? "–"}</td>
                <td className="num">
                  {m.speed?.batch_us_per_flow_1thread != null ? `${num(m.speed.batch_us_per_flow_1thread, 2)} µs` : "not measured"}
                </td>
                <td className="num">{m.size_mb != null ? `${num(m.size_mb, 2)} MB` : "–"}</td>
                <td>{m.explanation_label?.startsWith("SHAP") ? "SHAP (TreeSHAP)" : "Feature replacement"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">
        MCC: Matthews correlation coefficient, 1 is perfect. False alarms: share of benign flows flagged. Missed attacks:
        share of attack flows not flagged. Runs: training runs with different random seeds that the averages cover. Time
        per flow: batch prediction on one CPU thread, measured in Colab.
        {sources.length > 0 && ` Sources: ${sources.join("; ")}.`}
      </p>
    </section>
  );
}
