import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { matchPrompt } from "../src/prompts.js";

// Keeps backend prompts in sync with the app. Point APP_SRC at the app's App.jsx
// (defaults to a sibling ../undertow-android checkout).
const appPath = process.env.APP_SRC || fileURLToPath(new URL("../../undertow/undertow-android/src/App.jsx", import.meta.url));

test("every system prompt in the app's App.jsx is on the backend allowlist", { skip: !existsSync(appPath) && "App.jsx not found (set APP_SRC)" }, () => {
  const src = readFileSync(appPath, "utf8");
  const found = [...src.matchAll(/`(You are a[^`]*)`/g)].map((m) => m[1]);
  assert.equal(found.length, 4, "expected clarify + 3 lens prompts in App.jsx");
  for (const p of found) assert.ok(matchPrompt(p), `not allowlisted: ${p.slice(0, 60)}...`);
});
