import { test, expect } from "@playwright/test";

test("configured API handles registration, login errors, refresh, protected pages and logout", async ({ page, request, baseURL }) => {
  // This test creates a synthetic account and belongs only to the isolated QA stack.
  expect(["localhost", "127.0.0.1"]).toContain(new URL(baseURL!).hostname);
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL || "/api/v1";
  const apiBase = new URL(configured.replace(/\/+$/, "") + "/", baseURL).href;
  const destinations: string[] = [];
  page.on("request", (req) => {
    if (new URL(req.url()).pathname.startsWith("/api/v1/")) destinations.push(req.url());
  });
  await page.goto("/dashboard");
  await page.getByLabel("Username or email").fill("api_connectivity_member");
  await page.getByLabel("Password", { exact: true }).fill("InvalidPassword!123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Invalid username/email or password", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "New here? Create an account" }).click();
  await page.getByLabel("Your name", { exact: true }).fill("API Connectivity Member");
  await page.getByLabel("Username", { exact: true }).fill("api_connectivity_member");
  await page.getByLabel("Password (at least 12 characters)").fill("ConnectivityTest!123");
  const signedIn = page.waitForResponse((r) => r.url() === apiBase + "auth/login" && r.status() === 200);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  const token = (await (await signedIn).json()).access_token;
  await expect(page.getByRole("heading", { name: "A shared home starts here." })).toBeVisible();
  const cookie = (await page.context().cookies(apiBase + "auth/refresh")).find((c) => c.name === "roommate_refresh");
  expect(cookie?.httpOnly).toBe(true);
  expect(await page.evaluate((access) => JSON.stringify({ ...localStorage, ...sessionStorage }).includes(access), token)).toBe(false);
  await page.reload();
  await expect(page.getByRole("heading", { name: "A shared home starts here." })).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByLabel("Username or email")).toBeVisible();
  expect((await request.get(apiBase + "auth/me", { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(401);
  await page.goto("/dashboard");
  await expect(page.getByLabel("Username or email")).toBeVisible();
  expect(destinations.length).toBeGreaterThan(5);
  expect(destinations.every((url) => url.startsWith(apiBase))).toBe(true);
});
