import assert from "node:assert/strict";
import { test } from "node:test";
import { apiConfiguration, normalizeApiBaseUrl } from "./api-url.mjs";

for (const [input, expected] of [
  [undefined, "/api/v1"],
  ["/api/v1/", "/api/v1"],
  [" https://api.ledger.test/ ", "https://api.ledger.test/api/v1"],
  ["https://api.ledger.test/api/v1/", "https://api.ledger.test/api/v1"],
  ["http://127.0.0.1:8000", "http://127.0.0.1:8000/api/v1"],
]) {
  test(`normalizes ${String(input)}`, () => {
    assert.equal(normalizeApiBaseUrl(input), expected);
  });
}

for (const input of [
  "mongodb+srv://database.test",
  "https://user:private@api.ledger.test",
  "https://api.ledger.test?token=private",
  "https://api.ledger.test/#private",
  "https://api.ledger.test/api/v1/auth/login",
  "//api.ledger.test",
  "http://api.ledger.test",
]) {
  test(`rejects unsafe API input ${input.split(":")[0]}`, () => {
    assert.throws(() => normalizeApiBaseUrl(input));
  });
}

test("existing local and Docker proxy configurations still work", () => {
  assert.equal(apiConfiguration({}).proxyBaseUrl, "http://127.0.0.1:8000/api/v1");
  assert.equal(
    apiConfiguration({ API_INTERNAL_URL: "http://backend:8000/api/v1/" }).proxyBaseUrl,
    "http://backend:8000/api/v1",
  );
});

test("Vercel can connect directly without a proxy or duplicate version prefix", () => {
  assert.deepEqual(apiConfiguration({
    VERCEL: "1",
    NEXT_PUBLIC_API_BASE_URL: "https://api.ledger.test/api/v1/",
  }), { publicBaseUrl: "https://api.ledger.test/api/v1", proxyBaseUrl: null });
});

test("Vercel same-origin mode forwards to the configured FastAPI base", () => {
  assert.deepEqual(apiConfiguration({ VERCEL: "1", API_INTERNAL_URL: "https://api.ledger.test" }), {
    publicBaseUrl: "/api/v1", proxyBaseUrl: "https://api.ledger.test/api/v1",
  });
});

test("Vercel refuses missing, insecure and self-referencing upstreams", () => {
  for (const env of [
    {},
    { API_INTERNAL_URL: "http://127.0.0.1:8000" },
    { NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000" },
    { API_INTERNAL_URL: "https://web.ledger.test", VERCEL_PROJECT_PRODUCTION_URL: "web.ledger.test" },
  ]) assert.throws(() => apiConfiguration({ ...env, VERCEL: "1" }));
});
