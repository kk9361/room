import { test, expect } from "@playwright/test";
let roomId = "",
  bobId = "",
  adminId = "",
  adminAccess = "";
const errors: string[] = [];
test.describe.configure({ mode: "serial" });
test("bootstrap login, forced password change, create a room and invite members", async ({
  page,
  request,
}) => {
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByLabel("Username or email").fill("admin");
  await page.getByLabel("Password", { exact: true }).fill("TemporaryAdmin!123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Secure your account." }),
  ).toBeVisible();
  await page.getByLabel("Current password").fill("TemporaryAdmin!123");
  await page
    .getByLabel("New password (at least 12 characters)")
    .fill("NewAdminPassword!123");
  await page.getByLabel("Confirm new password").fill("NewAdminPassword!123");
  await page
    .getByRole("button", { name: "Change password", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A shared home starts here." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create a room" }).click();
  await page.getByLabel("Room name", { exact: true }).fill("The Boys House");
  await page.getByRole("button", { name: "Create room", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Recent shared expenses" }),
  ).toBeVisible();
  const admin = await (
    await request.post("/api/v1/auth/login", {
      data: {
        identifier: "admin",
        password: "NewAdminPassword!123",
        client: "mobile",
      },
    })
  ).json();
  adminAccess = admin.access_token;
  adminId = admin.user.id;
  const auth = { Authorization: `Bearer ${adminAccess}` };
  roomId = (
    await (await request.get("/api/v1/rooms", { headers: auth })).json()
  ).items[0].id;
  for (const username of ["bob", "chris"]) {
    const registered = await request.post("/api/v1/auth/register", {
      data: {
        username,
        display_name: username === "bob" ? "Bob" : "Chris",
        password: "MemberPassword!123",
      },
    });
    expect(registered.status()).toBe(201);
    const person = await (
      await request.post("/api/v1/auth/login", {
        data: {
          identifier: username,
          password: "MemberPassword!123",
          client: "mobile",
        },
      })
    ).json();
    if (username === "bob") bobId = person.user.id;
    await page.getByRole("link", { name: "Rooms & members" }).click();
    await page
      .getByRole("main")
      .getByRole("button", { name: "Invite a roommate", exact: true })
      .click();
    await page.getByLabel("Their username or email").fill(username);
    await page.getByRole("button", { name: "Create invitation" }).click();
    const token = await page
      .getByLabel("One-time invitation token")
      .inputValue();
    expect(
      (
        await request.post("/api/v1/invitations/accept", {
          headers: { Authorization: `Bearer ${person.access_token}` },
          data: { token },
        })
      ).status(),
    ).toBe(200);
    await page.getByRole("button", { name: "Close dialog" }).click();
    await page.getByRole("button", { name: "Refresh data" }).click();
    await expect(
      page.getByText(username === "bob" ? "Bob" : "Chris", { exact: true }),
    ).toBeVisible();
  }
  await page
    .context()
    .storageState({ path: "../../artifacts/admin-state.json" });
  expect(errors).toEqual([]);
});
test("equal, exact and percentage previews save and balances reconcile", async ({
  page,
}) => {
  await page
    .context()
    .addCookies(
      JSON.parse(
        await (
          await import("node:fs/promises")
        ).readFile("../../artifacts/admin-state.json", "utf8"),
      ).cookies,
    );
  await page.goto("/expenses");
  for (const [kind, description, amount] of [
    ["equal", "Weekly groceries", "900"],
    ["exact", "Exact shared bill", "300"],
    ["percentage", "Percentage utilities", "101"],
  ]) {
    await page
      .getByRole("button", { name: "Add expense", exact: true })
      .click();
    await page.getByLabel("Description", { exact: true }).fill(description);
    await page.getByLabel("Amount (₹)", { exact: true }).fill(amount);
    await page.getByLabel("Split method").selectOption(kind);
    if (kind === "exact") {
      await page.getByLabel("Administrator (₹)", { exact: true }).fill("100");
      await page.getByLabel("Bob (₹)", { exact: true }).fill("100");
      await page.getByLabel("Chris (₹)", { exact: true }).fill("100");
    }
    if (kind === "percentage") {
      await page.getByLabel("Administrator (%)", { exact: true }).fill("50");
      await page.getByLabel("Bob (%)", { exact: true }).fill("25");
      await page.getByLabel("Chris (%)", { exact: true }).fill("25");
    }
    await page.getByRole("button", { name: "Post shared expense" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText(description, { exact: true })).toBeVisible();
  }
  await page.reload();
  await expect(
    page.getByText("Weekly groceries", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Balances & settle up" }).click();
  await expect(
    page.getByRole("heading", { name: "Suggested transfers" }),
  ).toBeVisible();
  await expect(page.locator(".balance-members .balance-member")).toHaveCount(3);
});
test("personal expenses stay out of shared reports, support editing and deletion", async ({
  page,
  request,
}) => {
  await page
    .context()
    .addCookies(
      JSON.parse(
        await (
          await import("node:fs/promises")
        ).readFile("../../artifacts/admin-state.json", "utf8"),
      ).cookies,
    );
  // Refresh rotates the persisted cookie; use a fresh login for independent browser sessions.
  await signIn(page);
  await page.getByRole("link", { name: "My personal expenses" }).click();
  await page
    .getByRole("button", { name: "Add personal expense", exact: true })
    .click();
  await page
    .getByLabel("Description", { exact: true })
    .fill("Private headphones");
  await page.getByLabel("Amount (₹)", { exact: true }).fill("5000");
  await page.getByRole("button", { name: "Save personal expense" }).click();
  await expect(
    page.getByText("Private headphones", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View Private headphones" }).click();
  await page.getByRole("button", { name: "Edit expense" }).click();
  await page.getByLabel("Amount (₹)", { exact: true }).fill("4500");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("₹4,500.00", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  await expect(
    page.getByText("₹1,301.00", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "My personal report" }).click();
  await expect(
    page.getByText("₹4,500.00", { exact: true }).first(),
  ).toBeVisible();
  const bob = await (
    await request.post("/api/v1/auth/login", {
      data: {
        identifier: "bob",
        password: "MemberPassword!123",
        client: "mobile",
      },
    })
  ).json();
  expect(
    (
      await (
        await request.get("/api/v1/personal/expenses", {
          headers: { Authorization: `Bearer ${bob.access_token}` },
        })
      ).json()
    ).total,
  ).toBe(0);
  await page.getByRole("link", { name: "My personal expenses" }).click();
  await page.getByRole("button", { name: "View Private headphones" }).click();
  await page
    .getByRole("button", { name: "Delete expense", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete personal expense" }).click();
  await expect(
    page.getByText("Private headphones", { exact: true }),
  ).toHaveCount(0);
});
test("recipient confirmation, report export, announcements, and final admin protection", async ({
  page,
  request,
  browser,
}) => {
  await signIn(page);
  const bob = await (
    await request.post("/api/v1/auth/login", {
      data: {
        identifier: "bob",
        password: "MemberPassword!123",
        client: "mobile",
      },
    })
  ).json();
  const result = await request.post(`/api/v1/rooms/${roomId}/settlements`, {
    headers: {
      Authorization: `Bearer ${bob.access_token}`,
      "Idempotency-Key": "browser-payment-001",
    },
    data: { from_user_id: bobId, to_user_id: adminId, amount_paise: 10000 },
  });
  expect(result.status()).toBe(201);
  await page.getByRole("link", { name: "Balances & settle up" }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByRole("button", { name: "Confirm receipt" }).click();
  await expect(page.getByText("completed", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  expect((await downloadPromise).suggestedFilename()).toMatch(
    /roommate-.*\.csv/,
  );
  await page
    .getByRole("link", { name: "Announcements", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "New announcement" }).click();
  await page.getByLabel("Title", { exact: true }).fill("House meeting");
  await page
    .getByLabel("Announcement", { exact: true })
    .fill("Meet on Sunday to review our expenses.");
  await page.getByRole("button", { name: "Publish announcement" }).click();
  await expect(
    page.getByRole("heading", { name: "House meeting" }),
  ).toBeVisible();
  const memberContext = await browser.newContext({
    baseURL: new URL(page.url()).origin,
  });
  const memberPage = await memberContext.newPage();
  await memberPage.goto("/");
  await memberPage.getByLabel("Username or email").fill("bob");
  await memberPage
    .getByLabel("Password", { exact: true })
    .fill("MemberPassword!123");
  await memberPage.getByRole("button", { name: "Sign in", exact: true }).click();
  await memberPage.getByRole("link", { name: "Announcements", exact: true }).click();
  const memberPopupDismiss = memberPage.getByRole("button", {
    name: "Dismiss announcement popup",
  });
  if (await memberPopupDismiss.isVisible()) await memberPopupDismiss.click();
  await expect(
    memberPage.getByRole("button", { name: "New announcement" }),
  ).toBeVisible();
  await memberPage.getByRole("button", { name: "New announcement" }).click();
  await memberPage.getByLabel("Title", { exact: true }).fill("Bob's update");
  await memberPage
    .getByLabel("Announcement", { exact: true })
    .fill("The kitchen will be cleaned tonight.");
  await memberPage
    .getByRole("button", { name: "Publish announcement" })
    .click();
  await expect(
    memberPage.getByRole("heading", { name: "Bob's update" }),
  ).toBeVisible();
  await expect(
    page.getByRole("alert").filter({ hasText: "Bob's update" }),
  ).toBeVisible({ timeout: 20000 });
  await page.getByRole("button", { name: "Dismiss announcement popup" }).click();
  await page.getByRole("button", { name: /Notifications, 1 unread/ }).click();
  await page.getByRole("button", { name: /Bob's update/ }).click();
  await expect(
    page.getByRole("heading", { name: "Bob's update" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Notifications" })).toBeVisible();
  await memberContext.close();
  await page.getByRole("link", { name: "Rooms & members" }).click();
  await page
    .locator(".list-line")
    .filter({ hasText: "Administrator (you)" })
    .getByRole("button", { name: "Manage" })
    .click();
  await page.getByLabel("Room role").selectOption("room_member");
  await page.getByRole("button", { name: "Save member" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "final active room administrator",
  );
});
test("responsive pages, keyboard dialog, and browser errors", async ({
  page,
}) => {
  await signIn(page);
  const seen: string[] = [];
  page.on("pageerror", (e) => seen.push(e.message));
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Recent shared expenses" }),
    ).toBeVisible();
    await expect(page.getByText("Weekly groceries", { exact: true })).toBeVisible();
    await expect(page.locator(".month-hero").getByText("₹1,301.00", { exact: true }).first()).toBeVisible();
    const layout = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overflowers: [...document.querySelectorAll<HTMLElement>("body *")]
        .map((element) => ({
          name: `${element.tagName.toLowerCase()}${element.className && typeof element.className === "string" ? `.${element.className.trim().replace(/\s+/g, ".")}` : ""}`,
          left: Math.round(element.getBoundingClientRect().left),
          right: Math.round(element.getBoundingClientRect().right),
        }))
        .filter((element) => element.right > innerWidth + 1)
        .slice(0, 8),
    }));
    expect(layout.scrollWidth, JSON.stringify(layout)).toBeLessThanOrEqual(layout.width);
    await page.screenshot({
      path: `../../artifacts/dashboard-${width}.png`,
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "Create a shared expense" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Open more navigation" }).click();
  await expect(page.getByRole("link", { name: "Rooms & members" })).toBeVisible();
  await page.getByRole("link", { name: "Rooms & members" }).click();
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(seen).toEqual([]);
});
test('member permissions and offline submissions show errors without saving', async ({ page, request }) => {
  await page.goto('/');
  await page.getByLabel('Username or email').fill('bob');
  await page.getByLabel('Password', { exact: true }).fill('MemberPassword!123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Weekly groceries', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Platform admin' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Rooms & members' }).click();
  await expect(page.getByRole('main').getByRole('button', { name: 'Invite a roommate' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Manage', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Shared expenses' }).click();
  await expect(page.getByText('Weekly groceries', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add expense', exact: true }).click();
  await page.getByLabel('Description', { exact: true }).fill('Offline must not be saved');
  await page.getByLabel('Amount (₹)', { exact: true }).fill('10');
  await page.context().setOffline(true);
  await page.getByRole('button', { name: 'Post shared expense' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Could not reach the server');
  await page.context().setOffline(false);
  await page.getByRole('button', { name: 'Close dialog' }).click();
  const check = await request.get(`/api/v1/rooms/${roomId}/expenses?search=Offline%20must%20not%20be%20saved`, { headers: { Authorization: `Bearer ${adminAccess}` } });
  expect(check.status()).toBe(200);
  expect((await check.json()).total).toBe(0);
  await page.context().setOffline(true);
  await page.getByRole('button', { name: 'Refresh data' }).click();
  await expect(page.locator('.alert.error')).toContainText('Could not reach the server');
  await page.context().setOffline(false);
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.locator('.alert.error')).toHaveCount(0);
  await expect(page.getByText('Weekly groceries', { exact: true })).toBeVisible();
});

test("platform admin clears all database records only after both confirmations", async ({
  page,
  request,
}) => {
  await signIn(page);
  await page.getByRole("link", { name: "Platform admin" }).click();
  await page.getByRole("button", { name: "Clear all data" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("user accounts, sessions, and audit history");
  const clearButton = dialog.getByRole("button", {
    name: "Permanently clear all data",
  });
  await expect(clearButton).toBeDisabled();
  await dialog.getByLabel("Your administrator password").fill("WrongPassword!123");
  await dialog.getByLabel("Type CLEAR ALL DATA to confirm").fill("CLEAR ALL DATA");
  await expect(clearButton).toBeEnabled();
  await clearButton.click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Administrator password is incorrect",
  );
  const stillHasRooms = await request.get("/api/v1/admin/rooms", {
    headers: { Authorization: `Bearer ${adminAccess}` },
  });
  expect(stillHasRooms.status()).toBe(200);

  await dialog
    .getByLabel("Your administrator password")
    .fill("NewAdminPassword!123");
  page.once("dialog", async (alert) => {
    expect(alert.message()).toContain("Deleted");
    expect(alert.message()).toContain("Restart the API");
    await alert.accept();
  });
  await clearButton.click();
  await expect(page.getByLabel("Username or email")).toBeVisible({ timeout: 15000 });
  expect((await request.get("/api/v1/health/ready")).status()).toBe(200);
  expect(
    (
      await request.get("/api/v1/admin/users", {
        headers: { Authorization: `Bearer ${adminAccess}` },
      })
    ).status(),
  ).toBe(401);
});

async function signIn(page: import("@playwright/test").Page) {
  await page.context().clearCookies();
  await page.goto("/");
  await page.getByLabel("Username or email").fill("admin");
  await page
    .getByLabel("Password", { exact: true })
    .fill("NewAdminPassword!123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Recent shared expenses" }),
  ).toBeVisible();
}
