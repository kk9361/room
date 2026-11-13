/** Normalize an API origin or versioned base without exposing credentials. */
export function normalizeApiBaseUrl(
  value,
  { allowRelative = true, allowInsecureHttp = false } = {},
) {
  const input = (value || "").trim().replace(/\/+$/, "");
  if (!input || input === "/api/v1") {
    if (allowRelative) return "/api/v1";
    throw new Error("The backend API URL must be an absolute HTTP(S) URL.");
  }
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new Error("The API URL must be a backend origin or end in /api/v1.");
  }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    (url.protocol === "http:" && !loopback && !allowInsecureHttp) ||
    url.username || url.password || url.search || url.hash ||
    !["", "/", "/api/v1"].includes(url.pathname)
  ) {
    throw new Error(
      "Use an HTTPS backend origin or /api/v1 base, without credentials, query strings, or endpoint paths.",
    );
  }
  return `${url.origin}/api/v1`;
}

/** Resolve build-time browser routing and the optional same-origin proxy. */
export function apiConfiguration(env) {
  const publicBaseUrl = normalizeApiBaseUrl(env.NEXT_PUBLIC_API_BASE_URL);
  const internalUrl = env.API_INTERNAL_URL?.trim();
  const proxyBaseUrl = internalUrl
    ? normalizeApiBaseUrl(internalUrl, {
        allowRelative: false,
        allowInsecureHttp: env.VERCEL !== "1",
      })
    : publicBaseUrl === "/api/v1" && env.VERCEL !== "1"
      ? "http://127.0.0.1:8000/api/v1"
      : null;
  if (env.VERCEL === "1") {
    if (publicBaseUrl === "/api/v1" && !proxyBaseUrl) {
      throw new Error(
        "Configure API_INTERNAL_URL for the API proxy, or NEXT_PUBLIC_API_BASE_URL with the verified FastAPI URL, before deploying to Vercel.",
      );
    }
    for (const base of [publicBaseUrl, proxyBaseUrl]) {
      if (!base || base.startsWith("/")) continue;
      const url = new URL(base);
      const frontendHosts = [env.VERCEL_URL, env.VERCEL_PROJECT_PRODUCTION_URL];
      if (url.protocol !== "https:" || frontendHosts.includes(url.host)) {
        throw new Error("The production backend must use HTTPS and must not point back to this Vercel frontend.");
      }
    }
  }
  return { publicBaseUrl, proxyBaseUrl };
}
