import { createServer } from "node:http";
import { loadConfig, validateConfig } from "./config.js";
import { createHandler, corsHeaders, clientIp } from "./core.js";

export function buildServer(config, opts) {
  const handle = createHandler(config, opts);

  return createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const cors = corsHeaders(req.headers.origin, config);
    const send = (status, json, headers = {}) => {
      res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store", ...cors, ...headers });
      res.end(JSON.stringify(json));
    };

    if (url.pathname === "/health") return send(200, { ok: true });

    if (url.pathname !== "/api/interpret") return send(404, { error: "not_found" });

    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      return res.end();
    }

    // Read body with a hard size cap.
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > config.maxBodyBytes) return send(413, { error: "too_large" });
      chunks.push(chunk);
    }

    const out = await handle({
      method: req.method,
      headers: req.headers,
      rawBody: Buffer.concat(chunks).toString("utf8"),
      ip: clientIp(req, config),
    });
    send(out.status, out.json, out.headers);
  });
}

// Run directly: `node src/server.js`
if (import.meta.url === `file://${process.argv[1]}`) {
  const config = loadConfig();
  const problems = validateConfig(config);
  if (problems.length) {
    console.error("Refusing to start:\n - " + problems.join("\n - "));
    process.exit(1);
  }
  const server = buildServer(config);
  server.listen(config.port, () => console.log(`undertow-backend listening on :${config.port} (model: ${config.model})`));
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => server.close(() => process.exit(0)));
}
