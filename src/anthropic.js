export class UpstreamError extends Error {
  constructor(kind, message, status) {
    super(message);
    this.kind = kind; // "timeout" | "network" | "rejected" | "bad_response"
    this.status = status;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RETRYABLE = new Set([408, 409, 429, 500, 502, 503, 504, 529]);

/** Calls the Anthropic Messages API and returns the concatenated text. */
export async function complete({ config, system, userText, fetchImpl = fetch }) {
  const body = JSON.stringify({
    model: config.model,
    max_tokens: config.maxTokens,
    system,
    messages: [{ role: "user", content: userText }],
  });

  let lastError;
  for (let attempt = 0; attempt <= config.upstreamRetries; attempt++) {
    if (attempt > 0) await sleep(400 * 2 ** (attempt - 1) + Math.random() * 200);
    try {
      const res = await fetchImpl(`${config.baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body,
        signal: AbortSignal.timeout(config.upstreamTimeoutMs),
      });

      if (!res.ok) {
        // Never forward upstream error bodies to the app; log the type only.
        const detail = await res.text().catch(() => "");
        let errType = "";
        try { errType = JSON.parse(detail)?.error?.type || ""; } catch {}
        lastError = new UpstreamError("rejected", `upstream ${res.status} ${errType}`.trim(), res.status);
        if (RETRYABLE.has(res.status)) continue;
        throw lastError;
      }

      const data = await res.json();
      const text = (data.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();
      if (!text) throw new UpstreamError("bad_response", "upstream returned no text", res.status);
      return text;
    } catch (err) {
      if (err instanceof UpstreamError) {
        if (err.kind === "rejected" && RETRYABLE.has(err.status)) { lastError = err; continue; }
        throw err;
      }
      const timedOut = err?.name === "TimeoutError" || err?.name === "AbortError";
      lastError = new UpstreamError(timedOut ? "timeout" : "network", timedOut ? "upstream timed out" : `network: ${err?.message}`);
    }
  }
  throw lastError;
}
