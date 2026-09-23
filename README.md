# undertow-backend

The interpretation API for the Undertow app. It keeps your Anthropic API key on the
server and exposes one endpoint the app already knows how to call.

```
POST /api/interpret
x-app-secret: <APP_SHARED_SECRET>
{ "system": "...", "userText": "..." }   →   { "text": "..." }
GET  /health                              →   { "ok": true }
```

Zero runtime dependencies. Node 18.17+.

## What it does

- **Hides the API key.** The app never sees it; requests go to Claude from here.
- **Only serves the app's own prompts.** The four system prompts the app ships with
  (clarifying question + Jungian/Freudian/Existential) are allowlisted. Anything else is
  rejected with 403, so a secret extracted from the APK can't turn this into a free,
  general-purpose Claude endpoint.
- **Shared-secret check** (constant-time compare) on the `x-app-secret` header.
- **Rate limits** per client IP: 10/minute and 150/day by default.
- **Size limits:** 32 KB body, 8,000 characters of dream text.
- **Crisis backstop.** If the text contains self-harm language, it answers with fixed
  crisis-resource text (988 in the US) and does not call the model. The app only screens
  the dream text on the client, not the clarifying answer, so this closes that gap.
- **Retries and timeouts** to Anthropic (up to 2 retries on 429/5xx/529, 25 s timeout).
  Upstream error details are never passed to the app.
- **Privacy:** logs contain status, timing and prompt id only. Dream text is never logged.
- **CORS** for Capacitor's WebView origins (`https://localhost`, `capacitor://localhost`,
  `http://localhost`).

## Run locally

```bash
cp .env.example .env        # fill in ANTHROPIC_API_KEY and APP_SHARED_SECRET
npm run dev                 # http://localhost:8787
npm test                    # 25 tests, no network or API key needed
curl localhost:8787/health
```

## Deploy

Any of these works; pick one.

**Vercel (simplest for a serverless function)**
1. Push this folder to a Git repo and import it in Vercel.
2. Add env vars: `ANTHROPIC_API_KEY`, `APP_SHARED_SECRET` (and optionally `ANTHROPIC_MODEL`).
3. Your endpoint is `https://<project>.vercel.app/api/interpret`.
   Note: rate-limit counters live in each serverless instance's memory, so limits are
   best-effort there. For hard limits, back the limiter with Upstash/Vercel KV.

**Container host (Render, Fly.io, Railway, Cloud Run)**
Use the included `Dockerfile` (or `npm start`), set the same env vars, and set
`TRUST_PROXY=true` (already set in the Dockerfile) so per-IP limits use the real client IP.

## Connect the app

In the app's `src/App.jsx`:

```js
const API_ENDPOINT = "https://<your-host>/api/interpret";
const APP_SHARED_SECRET = "<same value as the backend's APP_SHARED_SECRET>";
```

Then rebuild: `npm run build && npx cap sync android`.

If you edit any system prompt in `App.jsx`, update `src/prompts.js` to match, or the
backend will reject it with 403. `npm test` checks this if it can find `App.jsx`
(set `APP_SRC=/path/to/App.jsx` if your checkout isn't next to this folder).

## Configuration

| Variable | Default | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Required |
| `APP_SHARED_SECRET` | — | Required; must match the app |
| `ANTHROPIC_MODEL` | `claude-sonnet-5` | Any Claude model id |
| `PORT` | `8787` | |
| `ALLOWED_ORIGINS` | Capacitor origins | Comma-separated; `*` for local dev only |
| `RATE_LIMIT_PER_MINUTE` | `10` | Per IP |
| `RATE_LIMIT_PER_DAY` | `150` | Per IP |
| `TRUST_PROXY` | `false` | `true` behind a proxy/load balancer |
| `ALLOW_CUSTOM_SYSTEM` | `false` | Leave off in production |
| `CRISIS_BACKSTOP` | `true` | |

## Limits worth knowing

- The shared secret ships inside the APK, so it only deters casual abuse. The real
  protection is the prompt allowlist plus rate limits. For per-user limits, add real
  authentication (Supabase/Firebase) and verify the user's token here instead of
  the shared secret.
- Dream text is sent to Anthropic for processing. Your in-app Privacy Policy already
  says so; keep it accurate if you change providers or add logging.
