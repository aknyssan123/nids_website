// Chart components from the NIDS Console design system: donut, gauge, probability bar, reason bars, confusion matrix.
import { cx, severityOf } from "./severity.js";

const vizColor = (tone) => `var(--viz-${tone}, var(--${tone}))`;

function arc(cx0, cy0, r, a0, a1) {
  const x0 = cx0 + r * Math.cos(a0), y0 = cy0 + r * Math.sin(a0);
  const x1 = cx0 + r * Math.cos(a1), y1 = cy0 + r * Math.sin(a1);
  return `M${x0} ${y0} A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}`;
}

// segments: [{label, value, tone}]; tone is a viz name (normal, attack, false-alarm, missed, caught) or a severity.
export function DonutChart({ segments = [], size = 168, thickness = 22, centerValue, centerLabel, ariaLabel,
                             format = (v) => v.toLocaleString("en-US") }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const R = size / 2, r = R - thickness / 2, gap = segments.filter((s) => s.value > 0).length > 1 ? 0.012 : 0;
  let a = -Math.PI / 2;
  return (
    <div className="nd-donut">
      <svg className="nd-chart" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
           aria-label={ariaLabel || "Donut chart"}>
        <circle cx={R} cy={R} r={r} fill="none" strokeWidth={thickness} style={{ stroke: "var(--viz-track)" }} />
        {segments.map((sg, i) => {
          const span = (sg.value / total) * Math.PI * 2;
          const a0 = a + gap, a1 = a + span - gap;
          a += span;
          if (sg.value <= 0) return null;
          if (span >= Math.PI * 2 - 0.001) {
            return <circle key={i} cx={R} cy={R} r={r} fill="none" strokeWidth={thickness} style={{ stroke: vizColor(sg.tone) }} />;
          }
          return <path key={i} d={arc(R, R, r, a0, Math.max(a1, a0 + 0.001))} fill="none" strokeWidth={thickness}
                       style={{ stroke: vizColor(sg.tone) }} />;
        })}
        {centerValue != null && <text className="nd-donut-center-v" x={R} y={R + 4} textAnchor="middle">{centerValue}</text>}
        {centerLabel && <text className="nd-donut-center-l" x={R} y={R + 22} textAnchor="middle">{centerLabel.toUpperCase()}</text>}
      </svg>
      <div className="nd-legend">
        {segments.map((sg, i) => (
          <div key={i} className="nd-legend-item">
            <span className="nd-legend-sw" style={{ background: vizColor(sg.tone) }} />
            <span>{sg.label}</span>
            <span className="nd-legend-val">{format(sg.value)}  {((sg.value / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Semicircle of radial ticks: ticks up to the value are ink, the rest are light. Value and label sit inside the arc.
const TICKS = 44;

export function Gauge({ value, min = 0, max = 1, label = "", format, minLabel, maxLabel }) {
  const cx0 = 110, cy0 = 104, r0 = 70, r1 = 96;
  const share = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const lit = Math.round(share * (TICKS - 1));
  const text = format ? format(value) : value;
  return (
    <div className="nd-gauge">
      <svg className="nd-chart" viewBox="0 0 220 124" role="img" aria-label={`${label}: ${text}`}>
        {Array.from({ length: TICKS }, (_, i) => {
          const a = Math.PI + (i / (TICKS - 1)) * Math.PI;
          const c = Math.cos(a), s = Math.sin(a);
          return <line key={i} x1={cx0 + r0 * c} y1={cy0 + r0 * s} x2={cx0 + r1 * c} y2={cy0 + r1 * s}
                       className={i <= lit && share > 0 ? "nd-tick-on" : "nd-tick-off"} />;
        })}
        <text className="nd-gauge-v" x={cx0} y={cy0 - 18} textAnchor="middle">{text}</text>
        <text className="nd-gauge-l" x={cx0} y={cy0 + 2} textAnchor="middle">{label}</text>
        <text x={cx0 - r1} y={cy0 + 18} textAnchor="middle">{minLabel ?? String(min)}</text>
        <text x={cx0 + r1} y={cy0 + 18} textAnchor="middle">{maxLabel ?? String(max)}</text>
      </svg>
    </div>
  );
}

export function ProbabilityBar({ value, threshold }) {
  const lvl = severityOf(value, threshold);
  return (
    <div className="nd-prob">
      <span className="nd-prob-num">{value.toFixed(3)}</span>
      <div className="nd-prob-track" aria-hidden="true">
        <div className="nd-prob-fill" style={{ width: `${value * 100}%`, background: `var(--${lvl})` }} />
      </div>
    </div>
  );
}

// Reasons as a diverging bar chart. reasons: [{feature, value, contribution, effect?}];
// `effect` is the backend's own rounded text and is shown in place of the number when present.
export function ReasonBars({ reasons = [] }) {
  const mx = reasons.reduce((m, x) => Math.max(m, Math.abs(x.contribution)), 0) || 1;
  return (
    <div className="nd-reasons">
      {reasons.map((it) => {
        const pct = (Math.abs(it.contribution) / mx) * 50, pos = it.contribution >= 0;
        return (
          <div key={it.feature} className="nd-reason">
            <span className="nd-reason-name" title={it.feature}>
              {it.feature}{it.value != null && it.value !== "" && <small>= {it.value}</small>}
            </span>
            <div className="nd-reason-axis" aria-hidden="true">
              <div className={cx("nd-reason-bar", pos ? "nd-reason-pos" : "nd-reason-neg")} style={{ width: `${pct}%` }} />
            </div>
            <span className="nd-reason-val">
              {it.effect ? it.effect.replace("-", "−") : `${pos ? "+" : "−"}${Math.abs(it.contribution).toFixed(3)}`}
            </span>
          </div>
        );
      })}
      <div className="nd-reason-legend" aria-hidden="true"><span>← toward normal</span><span>toward attack →</span></div>
    </div>
  );
}

export function ConfusionMatrix({ tp, fp, fn, tn }) {
  const f = (v) => v.toLocaleString("en-US");
  return (
    <div className="nd-cm">
      <span />
      <span className="nd-cm-h">Real attack</span>
      <span className="nd-cm-h">Real normal</span>
      <span className="nd-cm-h">Alerted</span>
      <div className="nd-cm-cell nd-cm-tp"><b>{f(tp)}</b><span>Attacks caught</span></div>
      <div className="nd-cm-cell nd-cm-fp"><b>{f(fp)}</b><span>False alarms</span></div>
      <span className="nd-cm-h">Not alerted</span>
      <div className="nd-cm-cell nd-cm-fn"><b>{f(fn)}</b><span>Missed attacks</span></div>
      <div className="nd-cm-cell nd-cm-tn"><b>{f(tn)}</b><span>Normal, passed</span></div>
    </div>
  );
}
