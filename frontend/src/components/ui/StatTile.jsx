// A big plain numeral with its label underneath, as in the hero panel. tone "alert" turns the number red.
export default function StatTile({ label, value, unit, hint, tone = "neutral" }) {
  return (
    <div className={`nd-stat nd-stat-${tone}`}>
      <span className="nd-stat-value">
        {value}
        {unit && <span className="nd-stat-unit">{unit}</span>}
      </span>
      <span className="nd-stat-label">{label}</span>
      {hint && <span className="nd-caption">{hint}</span>}
    </div>
  );
}
