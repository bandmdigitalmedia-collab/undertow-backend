const bool = (v, d) => (v === undefined || v === "" ? d : ["1", "true", "yes"].includes(String(v).toLowerCase()));
const int = (v, d) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : d;
};

export function loadConfig(env = process.env) {
  return {
    apiKey: env.ANTHROPIC_API_KEY || "",
    sharedSecret: env.APP_SHARED_SECRET || "",
    model: env.ANTHROPIC_MODEL || "claude-sonnet-5",
    baseUrl: (env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, ""),
    workspaceId: env.ANTHROPIC_WORKSPACE_ID || "",
    port: int(env.PORT, 8787),
    allowedOrigins: (env.ALLOWED_ORIGINS || "https://localhost,capacitor://localhost,http://localhost")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    perMinute: int(env.RATE_LIMIT_PER_MINUTE, 10),
    perDay: int(env.RATE_LIMIT_PER_DAY, 150),
    trustProxy: bool(env.TRUST_PROXY, false),
    allowCustomSystem: bool(env.ALLOW_CUSTOM_SYSTEM, false),
    crisisBackstop: bool(env.CRISIS_BACKSTOP, true),
    maxBodyBytes: 32 * 1024,
    maxUserTextChars: 8000,
    maxTokens: 1000,
    upstreamTimeoutMs: 25000,
    upstreamRetries: 2,
  };
}

export function validateConfig(config) {
  const problems = [];
  if (!config.apiKey) problems.push("ANTHROPIC_API_KEY is not set");
  if (!config.sharedSecret) problems.push("APP_SHARED_SECRET is not set");
  return problems;
}
