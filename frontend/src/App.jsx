import { useEffect, useMemo, useState } from "react";
import { analyze, getModels, getSamples } from "./api.js";
import DetectorList from "./components/DetectorList.jsx";
import RecordsInput from "./components/RecordsInput.jsx";
import FlowStrip from "./components/FlowStrip.jsx";
import Summary from "./components/Summary.jsx";
import ReasonBars from "./components/ReasonBars.jsx";
import AlertsTable from "./components/AlertsTable.jsx";
import ModelTable from "./components/ModelTable.jsx";

export default function App() {
  const [models, setModels] = useState([]);
  const [samples, setSamples] = useState([]);
  const [modelId, setModelId] = useState("");
  const [input, setInput] = useState({ kind: "sample", sampleId: "", file: null });
  const [threshold, setThreshold] = useState(0.5);
  const [result, setResult] = useState(null);
  const [phase, setPhase] = useState("loading"); // loading | ready | running | offline
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getModels(), getSamples()])
      .then(([m, s]) => {
        setModels(m);
        setSamples(s);
        const first = m.find((x) => x.default) || m[0];
        setModelId(first?.id || "");
        // start with the sample from the same network as the default detector
        const match = s.find((x) => first && x.network === first.trained_on) || s[0];
        setInput((i) => ({ ...i, sampleId: match?.id || "" }));
        setPhase("ready");
      })
      .catch((e) => {
        setError(e.message);
        setPhase("offline");
      });
  }, []);

  const model = models.find((m) => m.id === modelId);
  const sample = samples.find((s) => s.id === input.sampleId);
  const inputNetwork = input.kind === "sample" ? sample?.network : null;
  const mismatch = Boolean(model && inputNetwork && model.trained_on !== inputNetwork);
  const ready = model && (input.kind === "sample" ? Boolean(input.sampleId) : Boolean(input.file));

  async function run() {
    setPhase("running");
    setError("");
    try {
      const r = await analyze({ modelId, threshold, sampleId: input.sampleId, file: input.kind === "file" ? input.file : null });
      setResult({ ...r, threshold, inputNetwork });
    } catch (e) {
      setError(e.message);
    } finally {
      setPhase("ready");
    }
  }

  // Counts follow the slider immediately, using the per-flow scores returned by the last run.
  const live = useMemo(() => {
    if (!result) return null;
    const { scores, labels } = result;
    let alerts = 0, caught = 0, attacks = 0, falseAlarms = 0, benign = 0;
    for (let i = 0; i < scores.length; i++) {
      const hit = scores[i] >= threshold;
      if (hit) alerts++;
      if (labels) {
        if (labels[i] === 1) { attacks++; if (hit) caught++; }
        else if (labels[i] === 0) { benign++; if (hit) falseAlarms++; }
      }
    }
    return { flows: scores.length, alerts, caught, attacks, falseAlarms, benign, hasLabels: Boolean(labels) };
  }, [result, threshold]);

  return (
    <div className="page">
      <header className="masthead">
        <h1>Flow-based intrusion detector</h1>
        <p className="lede">
          Scores NetFlow v3 flow records with the machine-learning detectors from our study and shows why each
          alert was raised. Every detector was trained on one public dataset and is only reliable on that kind of network.
        </p>
      </header>

      {phase === "offline" ? (
        <section className="offline" role="alert">
          <h2>The detection service is not running</h2>
          <p>{error}</p>
          <p>To start it, open a terminal in the <code>backend</code> folder, run <code>uvicorn main:app --reload --port 8000</code>, then reload this page.</p>
        </section>
      ) : (
        <main className="workspace">
          <aside className="controls" aria-label="Detection settings">
            <section className="step">
              <h2><span className="step-no" aria-hidden="true">1</span>Detector</h2>
              <DetectorList models={models} value={modelId} onChange={setModelId} />
            </section>

            <section className="step">
              <h2><span className="step-no" aria-hidden="true">2</span>Flow records</h2>
              <RecordsInput samples={samples} value={input} onChange={setInput} />
              {mismatch && (
                <p className="note note-warn">
                  This detector was trained on {model.trained_on}. On {inputNetwork} records our cross-network test found
                  that detectors miss almost all attacks, so expect poor results here.
                </p>
              )}
            </section>

            <section className="step">
              <h2><span className="step-no" aria-hidden="true">3</span>Alert threshold</h2>
              <div className="threshold">
                <input id="threshold" type="range" min="0.05" max="0.95" step="0.05" value={threshold}
                       onChange={(e) => setThreshold(Number(e.target.value))} aria-describedby="threshold-help" />
                <output htmlFor="threshold">{threshold.toFixed(2)}</output>
              </div>
              <p id="threshold-help" className="hint">
                A flow becomes an alert when its attack probability reaches this value. Lower values catch more attacks
                and raise more false alarms.
              </p>
            </section>

            <button type="button" className="run" onClick={run} disabled={!ready || phase !== "ready"}>
              {phase === "running" ? "Running the detector…" : phase === "loading" ? "Loading detectors…" : "Run detector"}
            </button>
            {error && <p className="note note-error" role="alert">{error}</p>}
          </aside>

          <section className="results" aria-live="polite" aria-busy={phase === "running"}>
            {result ? (
              <>
                <FlowStrip scores={result.scores} labels={result.labels} threshold={threshold} sampled={result.scores_sampled} />
                <Summary live={live} summary={result.summary} threshold={threshold} runThreshold={result.threshold}
                         sampled={result.scores_sampled}
                         mismatch={Boolean(result.inputNetwork && result.inputNetwork !== result.summary.trained_on)} />
                <ReasonBars reasons={result.summary.top_reasons} method={result.summary.explanation}
                            explained={result.summary.explained_alerts} />
                <AlertsTable key={`${result.summary.model_id}-${result.threshold}-${result.summary.source}`}
                             alerts={result.alerts} summary={result.summary} runThreshold={result.threshold} />
              </>
            ) : (
              <div className="empty">
                <FlowStrip scores={null} />
                <p>
                  Choose a detector and a set of flow records, then run the detector. Each built-in sample holds 5,000 test
                  flows that no detector saw during training.
                </p>
              </div>
            )}
          </section>
        </main>
      )}

      {models.length > 0 && <ModelTable models={models} />}

      <footer className="colophon">
        <p>
          Research prototype accompanying a study of machine-learning intrusion detection on the NF-UNSW-NB15-v3 and
          NF-CSE-CIC-IDS2018-v3 NetFlow datasets. The Label column of the sample files is used only to report how the demo
          went; the detectors never see it. IP addresses, ports and times are displayed but are not model inputs.
        </p>
      </footer>
    </div>
  );
}
