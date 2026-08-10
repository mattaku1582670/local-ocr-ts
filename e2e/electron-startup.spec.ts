import { _electron as electron, expect, test } from "@playwright/test";

test("secure Electron shell starts the renderer", async () => {
  const application = await electron.launch({
    args: ["."],
    env: {
      ...process.env,
      NODE_ENV: "test",
    },
  });

  try {
    const page = await application.firstWindow();
    await expect(page).toHaveTitle("Local OCR");
    await expect(page.getByRole("heading", { name: "Local OCR" })).toBeVisible();

    const securityState = await page.evaluate(() => ({
      hasNodeRequire: Object.hasOwn(globalThis, "require"),
      hasDesktopApi: typeof window.desktopApi === "object",
    }));

    expect(securityState).toEqual({
      hasNodeRequire: false,
      hasDesktopApi: true,
    });

    const openedWindow = await page.evaluate(() => window.open("https://example.com"));
    expect(openedWindow).toBeNull();

    const csp = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute("content");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("connect-src 'self'");
  } finally {
    await application.close();
  }
});
