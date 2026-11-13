import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import type { User } from "../../../packages/api-contract/types";
const BASE: string =
  Constants.expoConfig?.extra?.apiUrl || "http://10.0.2.2:8000/api/v1";
let token: string | null = null;
let rotating: Promise<boolean> | null = null;
let unauthorized: (() => void) | null = null;
export const onUnauthorized = (callback: () => void) => {
  unauthorized = callback;
};
export const setAccess = (value: string | null) => {
  token = value;
};
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
async function fetchWithTimeout(path: string, options: RequestInit) {
  const controller = new AbortController(),
    timeout = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(`${BASE}${path}`, {
      ...options,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(
      "Cannot reach the server. Check your internet connection and retry.",
      0,
    );
  } finally {
    clearTimeout(timeout);
  }
}
async function saveSession(data: {
  access_token: string;
  refresh_token: string;
  user: User;
}) {
  await SecureStore.setItemAsync("roommate-refresh", data.refresh_token);
  token = data.access_token;
  return data.user;
}
export async function restore(): Promise<boolean> {
  if (!rotating)
    rotating = (async () => {
      try {
        const refresh = await SecureStore.getItemAsync("roommate-refresh");
        if (!refresh) return false;
        const response = await fetchWithTimeout("/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refresh, client: "mobile" }),
        });
        if (!response.ok) {
          if (response.status === 401)
            await SecureStore.deleteItemAsync("roommate-refresh");
          return false;
        }
        await saveSession(await response.json());
        return true;
      } finally {
        rotating = null;
      }
    })();
  return rotating;
}
export async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const response = await fetchWithTimeout(path, { ...options, headers });
  if (response.status === 401 && retry && !path.startsWith("/auth/login")) {
    if (await restore()) return api<T>(path, options, false);
    token = null;
    unauthorized?.();
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
    );
  }
  if (response.headers.get("content-type")?.includes("text/csv"))
    return (await response.text()) as T;
  return response.json();
}
export const post = <T = unknown>(path: string, body: unknown, key?: string) =>
  api<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
    headers: key ? { "Idempotency-Key": key } : {},
  });
export const patch = <T = unknown>(path: string, body: unknown) =>
  api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
export async function signIn(identifier: string, password: string) {
  return saveSession(
    await post("/auth/login", {
      identifier,
      password,
      client: "mobile",
      device_label: "Android",
    }),
  );
}
export async function signOut() {
  try {
    await post("/auth/logout", {});
  } finally {
    token = null;
    await SecureStore.deleteItemAsync("roommate-refresh");
  }
}
export async function changePassword(
  current_password: string,
  new_password: string,
) {
  return saveSession(
    await post("/auth/change-password", {
      current_password,
      new_password,
      client: "mobile",
    }),
  );
}
export {
  money,
  today,
  toPaise,
  previewSplit,
} from "../../../packages/api-contract/money";
export type {
  User,
  Room,
  Member,
  Category,
  Expense,
  Balance,
  Transfer,
  Settlement,
  Report,
  Announcement,
  Page,
} from "../../../packages/api-contract/types";
