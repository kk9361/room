import type { User } from "./types";
import { normalizeApiBaseUrl } from "../../config/api-url.mjs";
let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
// Next.js replaces this explicit NEXT_PUBLIC_ lookup during next build.
// All requests, including cookie refresh and CSV downloads, share this base.
const BASE = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}
export function setToken(token: string | null) {
  accessToken = token;
}
export async function refreshSession(): Promise<boolean> {
  if (!refreshing)
    refreshing = (async () => {
      try {
        const response = await fetch(`${BASE}/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        if (!response.ok) {
          accessToken = null;
          return false;
        }
        const data = await response.json();
        accessToken = data.access_token;
        return true;
      } catch {
        accessToken = null;
        return false;
      } finally {
        refreshing = null;
      }
    })();
  return refreshing;
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...options,
      headers,
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      "Could not reach the server. Check your connection and retry.",
      0,
      "OFFLINE",
    );
  }
  if (
    response.status === 401 &&
    retry &&
    !path.startsWith("/auth/login") &&
    !path.startsWith("/auth/refresh")
  ) {
    if (await refreshSession()) return api<T>(path, options, false);
    accessToken = null;
    if (typeof window !== "undefined")
      window.dispatchEvent(new Event("session-expired"));
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const details = data.error?.details
      ?.map(
        (x: { field: string; message: string }) =>
          `${x.field.replace("body.", "")}: ${x.message}`,
      )
      .join("; ");
    throw new ApiError(
      details || data.error?.message || `Request failed (${response.status})`,
      response.status,
      data.error?.code || "REQUEST_FAILED",
    );
  }
  if (response.headers.get("content-type")?.includes("text/csv"))
    return (await response.blob()) as T;
  return response.json();
}
export async function login(identifier: string, password: string) {
  const data = await api<{ access_token: string; user: User }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier, password }),
  });
  setToken(data.access_token);
  return data.user;
}
export const post = <T>(path: string, body: unknown, idempotencyKey?: string) =>
  api<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {},
  });
export const patch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
export {
  money,
  today,
  toPaise,
  previewSplit,
} from "../../../../packages/api-contract/money";
