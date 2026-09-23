import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { buildServer } from "../src/server.js";
import { PROMPTS } from "../src/prompts.js";
import { testConfig, SECRET, silent } from "./helpers.js";

// Fake Anthropic upstream + the real HTTP server in front of it.
const upstream = createServer((req, res) => {
  let b = "";
  req.on("data", (c) => (b += c));
  req.on("end", () => {
    const { system } = JSON.parse(b);
    const text = system === PROMPTS.clarify.system ? "How did it feel?" : '{"interpretation":"i","reflectionPrompt":"r","symbols":["lake"]}';
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ content: [{ type: "text", text }] }));
  });
});
await new Promise((r) => upstream.listen(0, r));
const cfg = testConfig({ baseUrl: `http://127.0.0.1:${upstream.address().port}` });
const app = buildServer(cfg, { log: silent });
await new Promise((r) => app.listen(0, r));
const base = `http://127.0.0.1:${app.address().port}`;
after(() => { app.close(); upstream.close(); });

const post = (body, headers = {}) =>
  fetch(`${base}/api/interpret`, { method: "POST", headers: { "content-type": "application/json", "x-app-secret": SECRET, ...headers }, body: JSON.stringify(body) });

test("GET /health", async () => {
  const r = await fetch(`${base}/health`);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
});

test("unknown route → 404", async () => {
  assert.equal((await fetch(`${base}/nope`)).status, 404);
});

test("CORS preflight allows Capacitor origin and the secret header", async () => {
  const r = await fetch(`${base}/api/interpret`, { method: "OPTIONS", headers: { origin: "https://localhost" } });
  assert.equal(r.status, 204);
  assert.equal(r.headers.get("access-control-allow-origin"), "https://localhost");
  assert.match(r.headers.get("access-control-allow-headers"), /x-app-secret/);
});

test("CORS does not echo unknown origins", async () => {
  const r = await fetch(`${base}/health`, { headers: { origin: "https://evil.example" } });
  assert.equal(r.headers.get("access-control-allow-origin"), null);
});

test("end-to-end: clarify question and lens interpretation, matching what the app parses", async () => {
  const q = await (await post({ system: PROMPTS.clarify.system, userText: "a dream" })).json();
  assert.equal(q.text, "How did it feel?");
  const r = await post({ system: PROMPTS.jungian.system, userText: "Dream: x\nClarifying detail: y" });
  assert.equal(r.status, 200);
  const parsed = JSON.parse((await r.json()).text);
  assert.deepEqual(parsed.symbols, ["lake"]);
});

test("oversized bodies are rejected", async () => {
  const r = await post({ system: PROMPTS.jungian.system, userText: "x".repeat(40_000) });
  assert.equal(r.status, 413);
});

test("bad secret → 401 over HTTP", async () => {
  assert.equal((await post({ system: PROMPTS.jungian.system, userText: "x" }, { "x-app-secret": "wrong" })).status, 401);
});
