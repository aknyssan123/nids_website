import { fmt, pct } from "../format.js";
import StatTile from "./ui/StatTile.jsx";

// Hero panel results: heading, the flow strip and the headline numbers. The numbers follow the slider, using the
// per-flow scores returned by the last run.
export default function Summary({ live, summary, threshold, strip }) {
  return (
    <section className="hero-results" aria-labelledby="summary-title">
      <h2 id="summary-title" className="hero-title">
        {fmt(live.alerts)} {live.alerts === 1 ? "alert" : "alerts"} in {fmt(live.flows)} flows
        <span className="hero-sub"> with {summary.model} at threshold {threshold.toFixed(2)}</span>
      </h2>
      <div className="hero-grid">
        <div className="hero-strip">{strip}</div>
        <div className="hero-stats">
          <StatTile label="Alerts" value={fmt(live.alerts)} hint={`${pct(live.alerts, live.flows)} of all flows`}
                    tone={live.alerts > 0 ? "alert" : "neutral"} />
          {live.hasLabels && (
            <>
              <StatTile label="Attacks caught" value={fmt(live.caught)} unit={`/ ${fmt(live.attacks)}`}
                        hint={`${pct(live.caught, live.attacks, 1)} of attack flows`} />
              <StatTile label="Missed attacks" value={fmt(live.missed)}
                        hint={`${pct(live.missed, live.attacks, 1)} of attack flows`}
                        tone={live.missed > 0 ? "alert" : "neutral"} />
              <StatTile label="False alarms" value={fmt(live.falseAlarms)}
                        hint={`${pct(live.falseAlarms, live.benign)} of benign flows`}
                        tone={live.falseAlarms > 0 ? "alert" : "neutral"} />
            </>
          )}
          <StatTile label="Flows per second" value={fmt(Math.round(summary.flows_per_second))}
                    hint={`scoring only; ${summary.seconds_total.toFixed(2)} s with reasons`} />
        </div>
      </div>
      {live.hasLabels && (
        <p className="nd-caption">
          Attack and false-alarm counts use the file’s Label column, which the detector never sees.
        </p>
      )}
    </section>
  );
}
