import { createHash, timingSafeEqual } from "node:crypto";
import { complete, UpstreamError } from "./anthropic.js";
import { RateLimiter } from "./rateLimit.js";
import { PROMPTS, matchPrompt, detectCrisis, crisisResponse } from "./prompts.js";

const sha = (s) => createHash("sha256").update(String(s)).digest();
const safeEqual = (a, b) => timingSafeEqual(sha(a), sha(b));

const reply = (status, json, headers = {}) => ({ status, json, headers });
const fail = (status, error, headers) => reply(status, { error }, headers);

/**
 * Framework-agnostic request handler. Adapters (node:http server, Vercel) translate
 * to/from this. Input:  { method, headers (lowercased keys), rawBody, ip }
 * Output: { status, json, headers }
 */
export function createHandler(config, { fetchImpl = fetch, log = defaultLog } = {}) {
  const perMinute = new RateLimiter({ limit: config.perMinute, windowMs: 60_000 });
  const perDay = new RateLimiter({ limit: config.perDay, windowMs: 86_400_000 });

  return async function handle({ method, headers, rawBody, ip }) {
    const started = Date.now();
    const done = (res, extra = {}) => {
      // Deliberately no request content in logs: dream text is private.
      log({ event: "interpret", status: res.status, ms: Date.now() - started, ...extra });
      return res;
    };

    if (method !== "POST") return done(fail(405, "method_not_allowed", { allow: "POST, OPTIONS" }));

    if (!config.apiKey || !config.sharedSecret) return done(fail(503, "server_misconfigured"));

    // Rate limit first so unauthenticated floods can't reach anything expensive.
    const key = ip || "unknown";
    const m = perMinute.hit(key);
    const d = perDay.hit(key);
    if (!m.allowed || !d.allowed) {
      const retry = !m.allowed ? m.retryAfterSec : d.retryAfterSec;
      return done(fail(429, "rate_limited", { "retry-after": String(retry) }));
    }

    const provided = headers["x-app-secret"];
    if (!provided || !safeEqual(provided, config.sharedSecret)) return done(fail(401, "unauthorized"));

    let payload;
    try {
      payload = JSON.parse(rawBody || "");
    } catch {
      return done(fail(400, "invalid_json"));
    }
    const { system, userText } = payload ?? {};
    if (typeof system !== "string" || typeof userText !== "string" || !system.trim() || !userText.trim()) {
      return done(fail(400, "invalid_request"));
    }
    if (userText.length > config.maxUserTextChars || system.length > 4000) {
      return done(fail(413, "too_large"));
    }

    const promptId = matchPrompt(system);
    if (!promptId && !config.allowCustomSystem) return done(fail(403, "prompt_not_allowed"));
    const kind = promptId ? PROMPTS[promptId].kind : "text";

    if (config.crisisBackstop && detectCrisis(userText)) {
      return done(reply(200, { text: crisisResponse(kind), safety: "crisis_backstop" }), { promptId, crisis: true });
    }

    try {
      const text = await complete({ config, system, userText, fetchImpl });
      return done(reply(200, { text }), { promptId });
    } catch (err) {
      const upstream = err instanceof UpstreamError;
      log({ event: "upstream_error", kind: upstream ? err.kind : "unknown", detail: upstream ? err.message : String(err?.message) });
      if (upstream && err.kind === "timeout") return done(fail(504, "upstream_timeout"), { promptId });
      return done(fail(502, "upstream_error"), { promptId });
    }
  };
}

function defaultLog(entry) {
  console.log(JSON.stringify({ t: new Date().toISOString(), ...entry }));
}

export function corsHeaders(origin, config) {
  const allowAll = config.allowedOrigins.includes("*");
  const allowed = allowAll || (origin && config.allowedOrigins.includes(origin));
  const h = {
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type, x-app-secret",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
  if (allowed) h["access-control-allow-origin"] = allowAll ? "*" : origin;
  return h;
}

export function clientIp(req, config) {
  if (config.trustProxy) {
    const fwd = req.headers["x-forwarded-for"];
    if (fwd) return String(fwd).split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}
