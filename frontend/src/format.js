export const fmt = (n) => (n ?? 0).toLocaleString("en-US");
export const pct = (part, whole, digits = 2) => (whole ? `${((100 * part) / whole).toFixed(digits)}%` : "–");
export const networkShort = (name) => (name === "CSE-CIC-IDS2018" ? "CIC-IDS2018" : name);

// "IN_BYTES=1001 (+2.31); TCP_FLAGS=22 (+0.80)" -> [{feature, value, effect, contribution}]
export function parseReasons(text) {
  if (!text) return [];
  return text.split("; ").map((part) => {
    const m = part.match(/^([^=]+)=(.*) \(([+-][^)]*)\)$/);
    return m
      ? { feature: m[1], value: m[2], effect: m[3], contribution: Number(m[3]) }
      : { feature: part, value: "", effect: "", contribution: NaN };
  });
}
