// One detector as a sidebar navigation item; the numbers are the study's test results from catalog.json.
export default function DetectorCard({ name, mcc, falseAlarmRate, selected, crossNetwork, onSelect }) {
  return (
    <button type="button" className="nav-item detector-item" aria-pressed={Boolean(selected)} onClick={onSelect}>
      <span className="nav-item-main">
        <span className="nav-item-name">{name}</span>
        <span className="nav-item-sub">
          False alarms <span className="nd-mono">{falseAlarmRate}</span>
        </span>
        {crossNetwork && <span className="nav-item-warn">Other network: expect poor results</span>}
      </span>
      <span className="nav-pill nd-mono" title="Matthews correlation coefficient on held-out test flows (1 = perfect)">
        <span className="visually-hidden">MCC </span>{mcc != null ? mcc.toFixed(3) : "–"}
      </span>
    </button>
  );
}
