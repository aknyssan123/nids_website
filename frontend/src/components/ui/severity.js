export const LEVEL_LABEL = { critical: "Critical", high: "High", medium: "Medium", low: "Low", benign: "Normal" };

// Map an attack probability to a severity level. Below the threshold = low (the flow is not alerted).
export function severityOf(p, threshold = 0.5) {
  if (p >= 0.95) return "critical";
  if (p >= 0.85) return "high";
  if (p >= threshold) return "medium";
  return "low";
}

export const cx = (...names) => names.filter(Boolean).join(" ");
