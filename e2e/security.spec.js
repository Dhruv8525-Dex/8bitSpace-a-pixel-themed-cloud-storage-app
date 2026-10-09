import { test, expect } from "@playwright/test";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const origin = "https://sajbwbtqlassnipnbdkk.supabase.co";
const hostile = "<img src=x onerror=alert(1)>";
async function signedIn(
  page,
  { provider, intentUser, age = 0, folders = [], files = [] } = {},
) {
  const user = {
    id,
    email: "test@example.com",
    aud: "authenticated",
    role: "authenticated",
    created_at: new Date().toISOString(),
    identities: provider ? [{ provider }] : [],
  };
  await page.addInitScript(
    ({ user, origin, provider, intentUser, age }) => {
      const now = Math.floor(Date.now() / 1000);
      const encode = (value) =>
        btoa(JSON.stringify(value))
          .replace(/=/g, "")
          .replace(/\+/g, "-")
          .replace(/\//g, "_");
      const claims = {
        sub: user.id,
        iss: `${origin}/auth/v1`,
        aud: "authenticated",
        role: "authenticated",
        is_anonymous: false,
        exp: now + 3600,
        iat: now,
        amr: [
          { method: provider ? "oauth" : "password", timestamp: now - age },
        ],
      };
      const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode(claims)}.dGVzdA`;
      localStorage.setItem(
        `sb-${new URL(origin).hostname.split(".")[0]}-auth-token`,
        JSON.stringify({
          access_token: token,
          refresh_token: "test-refresh-token",
          expires_at: now + 3600,
          user,
          token_type: "bearer",
        }),
      );
      if (intentUser)
        sessionStorage.setItem(
          "8bitspace-delete-intent",
          JSON.stringify({ userId: intentUser, startedAt: (now - 1) * 1000 }),
        );
    },
    { user, origin, provider, intentUser, age },
  );

  // mock all request not just to supabase, but also to the functions endpoint, so we can mock the delete-account function
  await page.route("**/*.supabase.co/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    };
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    let data = [];
    if (path.includes("/auth/")) data = user;
    if (path.includes("/folders")) data = folders;
    if (path.includes("/files")) data = files;
    if (path.includes("/profiles"))
      data = {
        id,
        display_name: hostile,
        avatar_url: "/avatars/avatar-01.jpeg",
        theme: "pixel-night",
        notifications: true,
      };
    await route.fulfill({
      status: 200,
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(data),
    });
  });
}

test("anonymous visitors cannot see the dashboard; security headers are sent", async ({
  page,
}) => {
  const response = await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create New", exact: true }),
  ).toHaveCount(0);
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["content-security-policy"]).toContain(
    "script-src 'self'",
  );
  expect(response.headers()["referrer-policy"]).toBe("no-referrer");
});
test("search with no matches can be cleared back to existing items", async ({
  page,
}) => {
  await signedIn(page, {
    folders: [
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        user_id: id,
        parent_id: null,
        name: "Project Nebula",
        updated_at: new Date().toISOString(),
        is_starred: false,
        trashed_at: null,
      },
    ],
  });
  await page.goto("/");
  await expect(page.getByText("Project Nebula", { exact: true })).toBeVisible();
  const search = page.getByPlaceholder("Search your cloud");
  await search.fill("nothing-here");
  await expect(
    page.getByRole("heading", { name: "No items match your search" }),
  ).toBeVisible();
  await expect(
    page.getByText("Create your first folder", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(search).toHaveValue("");
  await expect(page.getByText("Project Nebula", { exact: true })).toBeVisible();
});

test("folder menu requires confirmation before moving a folder and its contents to Trash", async ({
  page,
}) => {
  const folder = {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    user_id: id,
    parent_id: null,
    name: "Project Nebula",
    updated_at: new Date().toISOString(),
    is_starred: false,
    trashed_at: null,
  };
  const folderUpdates = [];
  const fileUpdates = [];
  await signedIn(page, { folders: [folder] });
  await page.route(`${origin}/rest/v1/folders**`, async (route) => {
    if (route.request().method() === "PATCH") {
      const update = route.request().postDataJSON();
      folderUpdates.push(update);
      folder.trashed_at = update.trashed_at;
      await route.fulfill({ status: 200, json: [] });
    } else await route.fulfill({ status: 200, json: [folder] });
  });
  page.on("request", (request) => {
    if (
      request.method() === "PATCH" &&
      new URL(request.url()).pathname.endsWith("/files")
    )
      fileUpdates.push(request.postDataJSON());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "SKIP ↗" }).click();
  await expect(page.getByText("Project Nebula", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Actions for Project Nebula" })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "Move to Trash" }),
  ).toBeVisible();
  await page.getByRole("menuitem", { name: "Move to Trash" }).click();
  const dialog = page.getByRole("alertdialog", {
    name: "Move Project Nebula to Trash?",
  });
  await expect(dialog).toContainText("subfolders, and all files inside");
  expect(folderUpdates).toHaveLength(0);
  expect(fileUpdates).toHaveLength(0);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  expect(folderUpdates).toHaveLength(0);
  await page
    .getByRole("button", { name: "Actions for Project Nebula" })
    .click();
  await page.getByRole("menuitem", { name: "Move to Trash" }).click();
  await page.getByRole("alertdialog").locator("input").fill("MOVE");
  await page
    .getByRole("button", { name: "Move to Trash", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "All folders 0" }),
  ).toBeVisible();
  expect(folderUpdates).toHaveLength(1);
  expect(fileUpdates).toHaveLength(1);
  expect(folderUpdates[0].trashed_at).toBeTruthy();
  await page.getByRole("button", { name: "Trash", exact: true }).click();
  await expect(page.getByText("Project Nebula", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Actions for Project Nebula" })
    .click();
  await expect(page.getByRole("menuitem", { name: "Restore" })).toBeVisible();
});

test("folder actions are available in mobile grid view without opening the folder", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signedIn(page, {
    folders: [
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        user_id: id,
        parent_id: null,
        name: "Project Nebula",
        updated_at: new Date().toISOString(),
        is_starred: false,
        trashed_at: null,
      },
    ],
  });
  await page.goto("/");
  await page.getByRole("button", { name: "SKIP ↗" }).click();
  await page.getByRole("button", { name: "Grid view" }).click();
  await page
    .getByRole("button", { name: "Actions for Project Nebula" })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "Move to Trash" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "All folders 1" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

for (const provider of ["google", "github"]) {
  test(`${provider} deletion offers provider verification without a password`, async ({
    page,
  }) => {
    await signedIn(page, { provider });
    await page.goto("/");
    await page.getByRole("button", { name: "Open profile photo menu" }).click();
    await page.getByRole("tab", { name: "Account", exact: true }).click();
    await page.getByRole("button", { name: "Delete my account" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByLabel("Current password")).toHaveCount(0);
    await expect(
      dialog.getByRole("button", {
        name: `Verify with ${provider === "google" ? "Google" : "GitHub"}`,
      }),
    ).toBeVisible();
    await dialog.locator("input").fill("DELETE ACCOUNT");
    await expect(
      dialog.getByRole("button", { name: "Delete account", exact: true }),
    ).toBeDisabled();
  });
  test(`${provider} callback requires final confirmation and supports retry after server rejection`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signedIn(page, { provider, intentUser: id });
    const requests = [];
    await page.route(`${origin}/functions/v1/delete-account`, async (route) => {
      requests.push(route.request().postDataJSON());
      await route.fulfill({
        status: 401,
        json: {
          error:
            "Please verify with Google or GitHub again, then confirm deletion.",
        },
      });
    });
    await page.goto("/?auth=callback");
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    expect(requests).toHaveLength(0);
    await expect(
      dialog.getByRole("button", { name: "Delete account", exact: true }),
    ).toBeDisabled();
    await dialog.locator("input").fill("DELETE ACCOUNT");
    await dialog
      .getByRole("button", { name: "Delete account", exact: true })
      .click();
    await expect(dialog.getByRole("alert")).toContainText(
      "verify with Google or GitHub again",
    );
    expect(requests).toEqual([
      {
        password: "",
        verification: "oauth",
        expectedUserId: id,
        confirmation: "DELETE ACCOUNT",
      },
    ]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.browser-check/${provider}-deletion-mobile.png`,
      fullPage: true,
      animations: "disabled",
    });
  });
}

for (const scenario of ["different account", "cancelled"]) {
  test(`deletion callback fails safely for ${scenario}`, async ({ page }) => {
    await signedIn(page, {
      provider: "google",
      intentUser: scenario === "different account" ? "other-user" : id,
    });
    await page.goto(
      scenario === "cancelled"
        ? "/?auth=callback&error=access_denied"
        : "/?auth=callback",
    );
    await expect(page).toHaveURL("http://127.0.0.1:4173/");
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem("8bitspace-delete-intent"),
      ),
    ).toBeNull();
  });
}

test("a returned OAuth callback reaches confirmation when local claims lookup is unreliable", async ({
  page,
}) => {
  await signedIn(page, { provider: "google", intentUser: id, age: 3600 });
  await page.route(`${origin}/functions/v1/delete-account`, (route) =>
    route.fulfill({
      status: 401,
      json: {
        error:
          "Please verify with Google or GitHub again, then confirm deletion.",
      },
    }),
  );
  await page.goto("/?auth=callback");
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await dialog.locator("input").fill("DELETE ACCOUNT");
  await dialog
    .getByRole("button", { name: "Delete account", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "verify with Google or GitHub again",
  );
});

test("successful verified deletion returns to sign-in only after explicit confirmation", async ({
  page,
}) => {
  await signedIn(page, { provider: "github", intentUser: id });
  let deleted = false;
  await page.route(`${origin}/functions/v1/delete-account`, async (route) => {
    deleted = true;
    await route.fulfill({ json: { deleted: true } });
  });
  await page.goto("/?auth=callback");
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  expect(deleted).toBe(false);
  await dialog.locator("input").fill("DELETE ACCOUNT");
  await dialog
    .getByRole("button", { name: "Delete account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  expect(deleted).toBe(true);
});
test("short signup passwords are blocked before sending a request", async ({
  page,
}) => {
  let submitted = false;
  await page.route(`${origin}/auth/v1/signup`, async (route) => {
    submitted = true;
    await route.abort();
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "NEW HERE? CREATE AN ACCOUNT →" })
    .click();
  await page.getByLabel("Email address").fill("test@example.com");
  await page.getByLabel("Password", { exact: true }).fill("short");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  expect(
    await page
      .getByLabel("Password", { exact: true })
      .evaluate((input) => input.validity.tooShort),
  ).toBe(true);
  expect(submitted).toBe(false);
});
test("untrusted profile text stays inert and account deletion requires a password", async ({
  page,
}) => {
  const dialogs = [];
  page.on("dialog", (dialog) => {
    dialogs.push(dialog.message());
    dialog.dismiss();
  });
  await signedIn(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Open profile photo menu" }).click();
  await page.getByRole("tab", { name: "Account", exact: true }).click();
  await expect(page.getByLabel("Display name")).toHaveValue(hostile);
  await page.getByRole("button", { name: "Delete my account" }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.locator("input").first().fill("DELETE ACCOUNT");
  await expect(
    dialog.getByRole("button", { name: "Delete account", exact: true }),
  ).toBeDisabled();
  await dialog.getByLabel("Current password").fill("test-password-only");
  await expect(
    dialog.getByRole("button", { name: "Delete account", exact: true }),
  ).toBeEnabled();
  expect(dialogs).toEqual([]);
  await page.screenshot({
    path: ".browser-check/account-security.png",
    fullPage: true,
    animations: "disabled",
  });
});

for (const provider of ["google", "github"]) {
  test(`${provider} sign-in sends PKCE and returns only to this app`, async ({
    page,
  }) => {
    await page.route(`${origin}/auth/v1/settings`, (route) =>
      route.fulfill({ json: { external: { google: true, github: true } } }),
    );
    await page.route(`${origin}/auth/v1/authorize**`, (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<h1>Provider redirect captured</h1>",
      }),
    );
    await page.goto("/");
    await page
      .getByRole("button", {
        name: `Continue with ${provider === "google" ? "Google" : "GitHub"}`,
      })
      .click();
    await expect(
      page.getByRole("heading", { name: "Provider redirect captured" }),
    ).toBeVisible();
    const url = new URL(page.url());
    expect(url.searchParams.get("provider")).toBe(provider);
    expect(url.searchParams.get("redirect_to")).toBe(
      "http://127.0.0.1:4173/?auth=callback",
    );
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(url.searchParams.get("code_challenge_method")?.toLowerCase()).toBe(
      "s256",
    );
  });
}
test("disabled provider keeps the user on the login page with a useful error", async ({
  page,
}) => {
  await page.route(`${origin}/auth/v1/settings`, (route) =>
    route.fulfill({ json: { external: { google: false, github: false } } }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page.getByRole("status")).toContainText("not available yet");
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeEnabled();
});
test("cancelled OAuth removes callback errors and offers sign-in again", async ({
  page,
}) => {
  await page.goto(
    "/?auth=callback&error=access_denied&error_description=untrusted-content",
  );
  await expect(page.getByRole("status")).toContainText("cancelled");
  await expect(page).toHaveURL("http://127.0.0.1:4173/");
  await expect(page.getByText("untrusted-content")).toHaveCount(0);
});
test("OAuth login fits a mobile screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with GitHub" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".browser-check/oauth-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});

test.describe("Cloud file type filters", () => {
  const MOCK_FOLDERS = [
    {
      id: "fdaa9c46-957a-4a0b-a431-fb3d0dc1599a",
      user_id: id,
      parent_id: null,
      name: "Project Nebula",
      is_starred: false,
      trashed_at: null,
      created_at: "2026-10-09T14:26:17.302893+00:00",
      updated_at: "2026-10-09T14:26:17.302893+00:00",
    },
  ];

  const MOCK_FILES = [
    {
      id: "0a5a0a6e-0890-4338-9bdf-8a1b75ff3e41",
      user_id: id,
      folder_id: MOCK_FOLDERS[0].id,
      name: "Microsoft.Services.Store.winmd",
      mime_type: "application/octet-stream",
      size_bytes: 5120,
      is_starred: false,
      trashed_at: null,
    },
    {
      id: "ba509922-8026-414e-bf98-3fbeed5ac227",
      user_id: id,
      folder_id: MOCK_FOLDERS[0].id,
      name: "luckylouie_20240529_001.pdf",
      mime_type: "application/pdf",
      size_bytes: 40278,
      is_starred: false,
      trashed_at: null,
    },
    {
      id: "1a58e927-f587-4e4d-950e-569cc7023a8e",
      user_id: id,
      folder_id: MOCK_FOLDERS[0].id,
      name: "t1-mua4ptnz-17be02059c234209b14a2a.mp4",
      mime_type: "video/mp4",
      size_bytes: 290739,
      is_starred: false,
      trashed_at: null,
    },
    {
      id: "db942259-b006-4751-853a-5ac43a54ca10",
      user_id: id,
      folder_id: MOCK_FOLDERS[0].id,
      name: "Links.txt",
      mime_type: "text/plain",
      size_bytes: 39,
      is_starred: false,
      trashed_at: null,
    },
    {
      id: "36e88fa2-9099-4143-93f1-96902c1f239d",
      user_id: id,
      folder_id: MOCK_FOLDERS[0].id,
      name: "584238.jpg",
      mime_type: "image/jpeg",
      size_bytes: 2633075,
      is_starred: false,
      trashed_at: null,
    },
    {
      id: "6cd53b64-8644-416e-8fbb-2232a896046e",
      user_id: id,
      folder_id: MOCK_FOLDERS[0].id,
      name: "cat-meme.gif",
      mime_type: "image/gif",
      size_bytes: 315125,
      is_starred: false,
      trashed_at: null,
    },
  ];

  test("filters files by type inside the current folder", async ({ page }) => {
    await signedIn(page, {
      folders: MOCK_FOLDERS,
      files: MOCK_FILES,
    });

    await page.goto("/");
    await page.getByRole("button", { name: "SKIP ↗" }).click();

    // Open the folder.
    await expect(
      page.getByText("Project Nebula", { exact: true }),
    ).toBeVisible();

    await page.getByText("Project Nebula", { exact: true }).click();



    const typeFilter = page.getByRole("combobox", {
      name: "Filter by file type",
    });

    const fileNames = {
      All: [
        "Microsoft.Services.Store.winmd",
        "luckylouie_20240529_001.pdf",
        "t1-mua4ptnz-17be02059c234209b14a2a.mp4",
        "Links.txt",
        "584238.jpg",
        "cat-meme.gif",
      ],
      Images: ["584238.jpg", "cat-meme.gif"],
      Videos: ["t1-mua4ptnz-17be02059c234209b14a2a.mp4"],
      PDFs: ["luckylouie_20240529_001.pdf"],
      Other: ["Microsoft.Services.Store.winmd", "Links.txt"],
    };

    for (const [label, expectedFiles] of Object.entries(fileNames)) {
      await typeFilter.selectOption({ label });
      console.log(`Checking filter: ${label}`);

      for (const name of expectedFiles) {
        await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
      }

      await page.waitForTimeout(1000);
    }

  });
});
