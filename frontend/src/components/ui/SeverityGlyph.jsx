import { cx, LEVEL_LABEL } from "./severity.js";

// Each level has its own shape, so meaning never rests on colour alone.
export function SeverityGlyph({ level = "low", size = 12 }) {
  let shape;
  if (level === "critical") shape = <polygon points="6,0 12,6 6,12 0,6" />;
  else if (level === "high") shape = <polygon points="6,0.5 12,11.5 0,11.5" />;
  else if (level === "medium") shape = <rect x="1" y="1" width="10" height="10" rx="1.5" />;
  else if (level === "benign") {
    shape = <path d="M1.5 6.5 L4.8 9.8 L10.8 2.6" fill="none" stroke="currentColor" strokeWidth="2.2"
                  strokeLinecap="round" strokeLinejoin="round" />;
  } else shape = <circle cx="6" cy="6" r="5" />;
  return (
    <svg className={cx("nd-glyph", `nd-g-${level}`)} width={size} height={size} viewBox="0 0 12 12" aria-hidden="true">
      {shape}
    </svg>
  );
}

export function SeverityBadge({ level = "low", solid = false, children }) {
  return (
    <span className={cx("nd-badge", `nd-badge-${level}`, solid && "nd-badge-solid")}>
      <SeverityGlyph level={level} size={10} />
      {children || LEVEL_LABEL[level]}
    </span>
  );
}
