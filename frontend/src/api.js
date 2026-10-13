// All calls to the FastAPI backend. VITE_API_URL is empty locally (Vite proxies /api).
const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

async function request(path, options) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, options);
  } catch {
    throw new Error("The detection service at port 8000 is not reachable.");
  }
  if (!res.ok) {
    let message = `The request failed (HTTP ${res.status}).`;
    try {
      const body = await res.json();
      if (body.detail) message = typeof body.detail === "string" ? body.detail : "The request was rejected: check the inputs.";
    } catch {
      /* keep the generic message */
    }
    throw new Error(message);
  }
  return res.json();
}

export const getModels = () => request("/api/models");
export const getSamples = () => request("/api/samples");

export function analyze({ modelId, threshold, sampleId, file }) {
  const form = new FormData();
  form.append("model_id", modelId);
  form.append("threshold", String(threshold));
  if (file) form.append("file", file);
  else form.append("sample_id", sampleId);
  return request("/api/analyze", { method: "POST", body: form });
}
