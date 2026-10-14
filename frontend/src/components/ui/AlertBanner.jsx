import { SeverityGlyph } from "./SeverityGlyph.jsx";

const GLYPH = { critical: "critical", warning: "high", info: "low", success: "benign" };

export default function AlertBanner({ tone = "info", title, action, children }) {
  return (
    <div className={`nd-banner nd-banner-${tone}`} role={tone === "critical" || tone === "warning" ? "alert" : "status"}>
      <SeverityGlyph level={GLYPH[tone]} size={16} />
      <div>
        <p className="nd-banner-title">{title}</p>
        {children && <div className="nd-banner-body">{children}</div>}
      </div>
      {action || null}
    </div>
  );
}
