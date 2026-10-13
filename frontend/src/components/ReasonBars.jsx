export default function ReasonBars({ reasons, method, explained }) {
  const items = Object.entries(reasons || {}).sort((a, b) => b[1] - a[1]);
  if (!items.length) return null;
  const max = items[0][1];
  return (
    <section className="reasons">
      <h2>What triggered the alerts</h2>
      <p className="hint">
        Strongest reason of each of the {explained.toLocaleString("en-US")} highest-scoring alerts. Method: {method}.
      </p>
      <ol className="bars">
        {items.map(([feature, count]) => (
          <li key={feature}>
            <code className="bar-label">{feature}</code>
            <span className="bar-track"><span className="bar-fill" style={{ width: `${(100 * count) / max}%` }} /></span>
            <span className="bar-value">{count.toLocaleString("en-US")}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
