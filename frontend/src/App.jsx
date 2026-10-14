import { useEffect, useMemo, useState } from "react";
import { analyze, getModels, getSamples } from "./api.js";
import { networkShort } from "./format.js";
import RecordsInput from "./components/RecordsInput.jsx";
import FlowStrip from "./components/FlowStrip.jsx";
import Summary from "./components/Summary.jsx";
import ResultCharts from "./components/ResultCharts.jsx";
import AlertsTable from "./components/AlertsTable.jsx";
import ModelTable from "./components/ModelTable.jsx";
import AlertBanner from "./components/ui/AlertBanner.jsx";
import Button from "./components/ui/Button.jsx";
import DetectorCard from "./components/ui/DetectorCard.jsx";
import ThresholdSlider from "./components/ui/ThresholdSlider.jsx";

export default function App() {
  const [models, setModels] = useState([]);
  const [samples, setSamples] = useState([]);
  const [modelId, setModelId] = useState("");
  const [input, setInput] = useState({ kind: "sample", sampleId: "", file: null });
  const [threshold, setThreshold] = useState(0.5);
  const [result, setResult] = useState(null);
  const [openRow, setOpenRow] = useState(null);
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
  const networks = [...new Set(models.map((m) => m.trained_on))];

  async function run() {
    setPhase("running");
    setError("");
    try {
      const r = await analyze({ modelId, threshold, sampleId: input.sampleId, file: input.kind === "file" ? input.file : null });
      setResult({ ...r, threshold, inputNetwork });
      setOpenRow(r.alerts[0]?.row ?? null);
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
    return { flows: scores.length, alerts, caught, attacks, falseAlarms, benign,
             missed: attacks - caught, tn: benign - falseAlarms, hasLabels: Boolean(labels) };
  }, [result, threshold]);

  const runModel = result && models.find((m) => m.id === result.summary.model_id);
  const resultMismatch = Boolean(result?.inputNetwork && result.inputNetwork !== result.summary.trained_on);
  const stale = result && threshold !== result.threshold;
  const recordsText = input.kind === "file"
    ? (input.file ? input.file.name : "no file chosen")
    : `${networkShort(sample?.network) || "no"} sample`;
  const status = phase === "offline" ? "Detection service offline"
    : phase === "loading" ? "Connecting to the detection service…"
    : "Detection service connected";

  return (
    <div className="app">
      <aside className="sidebar" aria-label="Detection settings">
        <p className="brand">Flow detector</p>

        <section className="side-section" aria-labelledby="side-detectors">
          <div className="side-head">
            <h2 id="side-detectors" className="side-title">Detectors</h2>
            <span className="side-hint" title="Matthews correlation coefficient on the study's test flows">MCC</span>
          </div>
          <div className="detector-groups">
            {networks.map((net) => (
              <div key={net} className="detector-group" role="group" aria-label={`Trained on ${networkShort(net)}`}>
                <p className="side-sub">Trained on {networkShort(net)}</p>
                <div className="nav-list">
                  {models.filter((m) => m.trained_on === net).map((m) => (
                    <DetectorCard key={m.id} name={m.family} mcc={m.metrics?.mcc}
                                  falseAlarmRate={m.metrics?.false_alarm_pct != null ? `${m.metrics.false_alarm_pct.toFixed(3)}%` : "–"}
                                  selected={m.id === modelId}
                                  crossNetwork={Boolean(inputNetwork && m.trained_on !== inputNetwork)}
                                  onSelect={() => setModelId(m.id)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="side-section side-threshold" aria-labelledby="side-threshold">
          <div className="side-head"><h2 id="side-threshold" className="side-title">Alert threshold</h2></div>
          <ThresholdSlider label="Attack probability" value={threshold} onChange={setThreshold}
                           min={0.05} max={0.95} step={0.05} hintId="threshold-help"
                           hint="A flow becomes an alert when its attack probability reaches this value. Lower values catch more attacks and raise more false alarms." />
        </section>

        <p className={`side-status is-${phase}`} role="status">
          <span className="status-dot" aria-hidden="true" />{status}
        </p>
      </aside>

      <div className="main">
        <div className="hero">
          <header className="topbar">
            <div className="topbar-text">
              <h1 className="page-title">Flow-based intrusion detector</h1>
              <p className="topbar-sel">
                {model ? `${model.family} (${networkShort(model.trained_on)})` : "No detector"} · {recordsText} · threshold{" "}
                <span className="nd-mono">{threshold.toFixed(2)}</span>
              </p>
            </div>
            <Button variant="primary" className="run" onClick={run} disabled={!ready || phase !== "ready"}
                    loading={phase === "running"}>
              {phase !== "running" && (
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor" /></svg>
              )}
              {phase === "running" ? "Running…" : phase === "loading" ? "Loading…" : "Run detector"}
            </Button>
          </header>

          <div className="banners">
            {phase === "offline" && (
              <AlertBanner tone="critical" title="The detection service is not running">
                <p>{error}</p>
                <p>
                  To start it, open a terminal in the <code>backend</code> folder, run{" "}
                  <code>uvicorn main:app --reload --port 8000</code>, then reload this page.
                </p>
              </AlertBanner>
            )}
            {phase !== "offline" && error && <AlertBanner tone="critical" title="The detector could not run">{error}</AlertBanner>}
            {mismatch && (
              <AlertBanner tone="warning" title="This detector was trained on another network">
                {model.family} was trained on {networkShort(model.trained_on)}. On {networkShort(inputNetwork)} records
                our cross-network test found that detectors miss almost all attacks, so expect poor results here.
              </AlertBanner>
            )}
            {resultMismatch && !mismatch && (
              <AlertBanner tone="warning" title="Results on another network">
                These records come from a different network than the detector’s training data
                ({networkShort(result.summary.trained_on)}). This is the study’s cross-network finding, not a fault.
              </AlertBanner>
            )}
            {stale && (
              <AlertBanner tone="info" title={`You moved the threshold from ${result.threshold.toFixed(2)}`}>
                The counts, the strip and the charts follow it; run the detector again to refresh the reasons and the
                alert list.
              </AlertBanner>
            )}
          </div>

          <div aria-live="polite" aria-busy={phase === "running"}>
            {result ? (
              <Summary live={live} summary={result.summary} threshold={threshold}
                       strip={<FlowStrip scores={result.scores} labels={result.labels} threshold={threshold}
                                         sampled={result.scores_sampled} />} />
            ) : (
              <div className="hero-empty">
                <p className="lede">
                  Scores NetFlow v3 flow records with the machine-learning detectors from our study and shows why each
                  alert was raised. Every detector was trained on one public dataset and is only reliable on that kind of
                  network.
                </p>
                <FlowStrip scores={null} />
                <p className="panel-text">
                  Choose a detector in the side panel and flow records below, then run the detector. Each built-in
                  sample holds 5,000 test flows that no detector saw during training.
                </p>
              </div>
            )}
          </div>
        </div>

        <main className="content">
          {phase !== "offline" && (
            <section className="card records-card" aria-labelledby="records-title">
              <div className="card-head">
                <h2 id="records-title" className="card-title card-title-lg">Flow records</h2>
                <span className="chip-outline">{recordsText}</span>
              </div>
              <div className="card-body">
                <RecordsInput samples={samples} value={input} onChange={setInput} />
              </div>
            </section>
          )}

          {result && (
            <>
              {result.scores_sampled && (
                <p className="nd-caption">The file is large, so the counts and charts use an even sample of its flows.</p>
              )}
              <ResultCharts live={live} model={runModel} summary={result.summary} />
              <AlertsTable key={`${result.summary.model_id}-${result.threshold}-${result.summary.source}`}
                           alerts={result.alerts} summary={result.summary} runThreshold={result.threshold}
                           openRow={openRow} onToggle={(row) => setOpenRow((r) => (r === row ? null : row))} />
            </>
          )}

          {models.length > 0 && <ModelTable models={models} />}

          <footer className="colophon">
            <p>
              Research prototype accompanying a study of machine-learning intrusion detection on the NF-UNSW-NB15-v3 and
              NF-CSE-CIC-IDS2018-v3 NetFlow datasets. The Label column of the sample files is used only to report how the
              demo went; the detectors never see it. IP addresses, ports and times are displayed but are not model inputs.
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
