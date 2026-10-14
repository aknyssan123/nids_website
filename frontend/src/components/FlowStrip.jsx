import { useEffect, useRef } from "react";
import { fmt } from "../format.js";

const SCORE_H = 120;
const GAP = 8;
const TRUTH_H = 8;
const TICK_H = 18;
const AXIS_W = 30;

// Colours come from the design tokens.
function palette(el) {
  const s = getComputedStyle(el);
  const v = (name) => s.getPropertyValue(name).trim();
  return { normal: v("--viz-normal"), attack: v("--viz-attack"), grid: v("--viz-grid"), threshold: v("--viz-threshold"),
           truth: v("--ink"), track: v("--viz-track"), tick: v("--ink-muted"), mono: v("--font-mono") };
}

// Diagonal hatching for flows below the threshold, like the light bars of the reference chart.
function hatch(ctx, color) {
  const tile = document.createElement("canvas");
  tile.width = tile.height = 6;
  const t = tile.getContext("2d");
  t.strokeStyle = color;
  t.lineWidth = 1.5;
  t.beginPath();
  t.moveTo(0, 6);
  t.lineTo(6, 0);
  t.moveTo(-1, 1);
  t.lineTo(1, -1);
  t.moveTo(5, 7);
  t.lineTo(7, 5);
  t.stroke();
  return ctx.createPattern(tile, "repeat");
}

// Every column is a run of consecutive flows in file order. Column height = highest attack probability in the run;
// columns at or above the threshold are red, the rest hatched grey. The dashed line is the threshold and follows the slider.
export default function FlowStrip({ scores, labels, threshold = 0.5, sampled = false }) {
  const box = useRef(null);
  const canvas = useRef(null);

  useEffect(() => {
    const el = canvas.current;
    const wrap = box.current;
    if (!el || !wrap) return undefined;
    const draw = () => {
      const c = palette(el);
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.floor(wrap.clientWidth));
      const plotW = Math.max(1, width - AXIS_W);
      const truthTop = SCORE_H + GAP;
      const height = SCORE_H + (labels ? GAP + TRUTH_H : 0) + TICK_H;
      el.width = Math.round(width * dpr);
      el.height = Math.round(height * dpr);
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;
      const ctx = el.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // y axis: 0, 0.5, 1 with faint gridlines
      ctx.font = `500 11px ${c.mono}`;
      ctx.fillStyle = c.tick;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (const v of [0, 0.5, 1]) {
        const y = Math.round(SCORE_H - v * (SCORE_H - 6)) - 0.5;
        ctx.fillText(v.toFixed(1), AXIS_W - 8, Math.min(Math.max(y, 6), SCORE_H - 4));
        ctx.fillStyle = c.grid;
        ctx.fillRect(AXIS_W, y, plotW, 1);
        ctx.fillStyle = c.tick;
      }
      if (!scores || scores.length === 0) return;

      const below = hatch(ctx, c.normal);
      const n = scores.length;
      const cols = Math.min(Math.floor(plotW / 3), n);
      const colW = plotW / cols;
      const barW = Math.max(colW - (colW >= 3 ? 1 : 0), 1);
      for (let col = 0; col < cols; col++) {
        const a = Math.floor((col * n) / cols);
        const b = Math.max(a + 1, Math.floor(((col + 1) * n) / cols));
        let max = 0;
        let attack = false;
        for (let i = a; i < b; i++) {
          if (scores[i] > max) max = scores[i];
          if (labels && labels[i] === 1) attack = true;
        }
        const h = Math.max(3, Math.round(max * (SCORE_H - 6)));
        const x = AXIS_W + col * colW;
        // very short bars are drawn solid: hatching would make them invisible
        ctx.fillStyle = max >= threshold ? c.attack : h < 10 ? c.normal : below;
        ctx.fillRect(x, SCORE_H - h, barW, h);
        if (labels) {
          ctx.fillStyle = attack ? c.truth : c.track;
          ctx.fillRect(x, truthTop, barW, TRUTH_H);
        }
      }
      const y = Math.round(SCORE_H - threshold * (SCORE_H - 6)) + 0.5;
      ctx.strokeStyle = c.threshold;
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(AXIS_W, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = c.tick;
      ctx.textBaseline = "bottom";
      ctx.textAlign = "left";
      ctx.fillText("flow 1", AXIS_W, height - 1);
      ctx.textAlign = "right";
      ctx.fillText(`flow ${fmt(n)}`, width, height - 1);
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [scores, labels, threshold]);

  const n = scores ? scores.length : 0;
  return (
    <figure className={scores ? "strip" : "strip is-placeholder"}>
      <div className="strip-head">
        <span className="strip-title">Attack probability, flow by flow</span>
        {scores && <span className="nd-caption">{fmt(n)} flows in file order{sampled ? " (evenly sampled)" : ""}</span>}
      </div>
      <div ref={box} className="strip-canvas">
        <canvas ref={canvas} role="img"
                aria-label={scores ? `Attack probability of ${n} flows in file order; red columns reach the threshold ${threshold.toFixed(2)}`
                                   : "Empty flow strip"} />
      </div>
      {scores && (
        <figcaption className="strip-legend">
          <span className="strip-key"><i className="key key-attack" /> reaches the threshold</span>
          <span className="strip-key"><i className="key key-hatch" /> below it</span>
          <span className="strip-key"><i className="key-dash" /> threshold {threshold.toFixed(2)}</span>
          {labels && <span className="strip-key"><i className="key key-truth" /> lower band: attacks according to the file’s labels</span>}
        </figcaption>
      )}
    </figure>
  );
}
