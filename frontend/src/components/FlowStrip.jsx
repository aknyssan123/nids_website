import { useEffect, useRef } from "react";
import { fmt } from "../format.js";

const ALERT = "#eb6834";
const CALM = "#9fb7cf";
const TRUTH = "#1d2733";
const TRACK = "#e3e9ef";
const SCORE_H = 72;
const GAP = 8;
const TRUTH_H = 10;

// Every column is a run of consecutive flows in file order. Column height = highest attack probability in the run;
// columns at or above the threshold are orange. The dashed line is the threshold and follows the slider.
export default function FlowStrip({ scores, labels, threshold = 0.5, sampled = false }) {
  const box = useRef(null);
  const canvas = useRef(null);

  useEffect(() => {
    const el = canvas.current;
    const wrap = box.current;
    if (!el || !wrap) return undefined;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.floor(wrap.clientWidth));
      const height = SCORE_H + (labels ? GAP + TRUTH_H : 0);
      el.width = Math.round(width * dpr);
      el.height = Math.round(height * dpr);
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;
      const ctx = el.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = TRACK;
      ctx.fillRect(0, SCORE_H - 1, width, 1);
      if (!scores || scores.length === 0) return;
      const n = scores.length;
      const cols = Math.min(Math.floor(width / 2), n);
      const colW = width / cols;
      const barW = Math.max(colW - (colW >= 3 ? 1 : 0), 1);
      for (let c = 0; c < cols; c++) {
        const a = Math.floor((c * n) / cols);
        const b = Math.max(a + 1, Math.floor(((c + 1) * n) / cols));
        let max = 0;
        let attack = false;
        for (let i = a; i < b; i++) {
          if (scores[i] > max) max = scores[i];
          if (labels && labels[i] === 1) attack = true;
        }
        const h = Math.max(2, Math.round(max * (SCORE_H - 2)));
        ctx.fillStyle = max >= threshold ? ALERT : CALM;
        ctx.fillRect(c * colW, SCORE_H - 1 - h, barW, h);
        if (labels) {
          ctx.fillStyle = attack ? TRUTH : TRACK;
          ctx.fillRect(c * colW, SCORE_H + GAP, barW, TRUTH_H);
        }
      }
      const y = Math.round(SCORE_H - 1 - threshold * (SCORE_H - 2)) + 0.5;
      ctx.strokeStyle = TRUTH;
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [scores, labels, threshold]);

  const n = scores ? scores.length : 0;
  return (
    <figure className={scores ? "strip" : "strip is-placeholder"}>
      <div ref={box} className="strip-canvas">
        <canvas ref={canvas} role="img"
                aria-label={scores ? `Attack probability of ${n} flows in file order; orange columns reach the threshold ${threshold.toFixed(2)}`
                                   : "Empty flow strip"} />
      </div>
      {scores && (
        <figcaption>
          <span><i className="key key-alert" /> reaches the threshold</span>
          <span><i className="key key-calm" /> below it</span>
          {labels && <span><i className="key key-truth" /> lower band: attacks according to the file’s labels</span>}
          <span className="strip-count">{fmt(n)} flows in file order{sampled ? " (evenly sampled)" : ""}</span>
        </figcaption>
      )}
    </figure>
  );
}
