// Controlled slider: the track left of the thumb is "normal", right of it "alerted".
export default function ThresholdSlider({ id = "threshold", label = "Alert threshold", value, onChange,
                                          min = 0, max = 1, step = 0.01, hint, hintId }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="nd-slider">
      <div className="nd-slider-top">
        <label className="nd-label" htmlFor={id}>{label}</label>
        <output className="nd-slider-value" htmlFor={id}>{value.toFixed(2)}</output>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value}
             onChange={(e) => onChange(Number(e.target.value))}
             aria-describedby={hint ? hintId : undefined} style={{ "--nd-pct": `${pct}%` }} />
      <div className="nd-slider-scale" aria-hidden="true"><span>more alerts</span><span>fewer alerts</span></div>
      {hint && <span id={hintId} className="nd-caption">{hint}</span>}
    </div>
  );
}
