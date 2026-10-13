export const fmt = (n) => (n ?? 0).toLocaleString("en-US");
export const pct = (part, whole, digits = 2) => (whole ? `${((100 * part) / whole).toFixed(digits)}%` : "–");
export const networkShort = (name) => (name === "CSE-CIC-IDS2018" ? "CIC-IDS2018" : name);
