import { loadConfig } from "../src/config.js";
import { PROMPTS } from "../src/prompts.js";

export const SECRET = "test-secret";

export const testConfig = (over = {}) => ({
  ...loadConfig({ ANTHROPIC_API_KEY: "sk-test", APP_SHARED_SECRET: SECRET }),
  upstreamRetries: 1,
  ...over,
});

export const req = (body, over = {}) => ({
  method: "POST",
  headers: { "x-app-secret": SECRET },
  rawBody: typeof body === "string" ? body : JSON.stringify(body),
  ip: "1.2.3.4",
  ...over,
});

export const valid = (over = {}) => ({ system: PROMPTS.jungian.system, userText: "I was flying over a dark lake.", ...over });

export const anthropicOk = (text) =>
  new Response(JSON.stringify({ content: [{ type: "text", text }], stop_reason: "end_turn" }), { status: 200 });

export const silent = () => {};
