import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development, requests to /api go to the FastAPI backend on port 8000 (no CORS setup needed).
// 127.0.0.1 rather than localhost: on Windows, Node may resolve localhost to IPv6 (::1), where uvicorn is not listening.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": "http://127.0.0.1:8000" } },
});
