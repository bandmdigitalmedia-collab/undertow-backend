// Vercel serverless adapter → POST /api/interpret
import { loadConfig } from "../src/config.js";
import { createHandler, corsHeaders, clientIp } from "../src/core.js";

const config = { ...loadConfig(), trustProxy: true };
const handle = createHandler(config);

export default async function handler(req, res) {
  const cors = corsHeaders(req.headers.origin, config);
  for (const [k, v] of Object.entries(cors)) res.setHeader(k, v);
  res.setHeader("cache-control", "no-store");

  if (req.method === "OPTIONS") return res.status(204).end();

  const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
  if (rawBody.length > config.maxBodyBytes) return res.status(413).json({ error: "too_large" });

  const out = await handle({ method: req.method, headers: req.headers, rawBody, ip: clientIp(req, config) });
  for (const [k, v] of Object.entries(out.headers || {})) res.setHeader(k, v);
  res.status(out.status).json(out.json);
}
