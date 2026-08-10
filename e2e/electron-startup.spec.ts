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
    await expect(page.getByRole("navigation", { name: "OCR操作" })).toBeVisible();
    await expect(page.getByRole("button", { name: "画像を開く" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "貼り付け" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "画像をドロップまたは選択" })).toBeVisible();

    const securityState = await page.evaluate(() => ({
      hasNodeRequire: Object.hasOwn(globalThis, "require"),
      hasDesktopApi: typeof window.desktopApi === "object",
      hasFileApi: typeof window.desktopApi.files.openImages === "function",
      hasClipboardApi: typeof window.desktopApi.clipboard.readImage === "function",
    }));

    expect(securityState).toEqual({
      hasNodeRequire: false,
      hasDesktopApi: true,
      hasFileApi: true,
      hasClipboardApi: true,
    });

    const openedWindow = await page.evaluate(() => window.open("https://example.com"));
    expect(openedWindow).toBeNull();

    const csp = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute("content");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("connect-src 'self'");

    const settingsRoundTrip = await page.evaluate(async () => {
      type SettingsValue = { autoOcrAfterPaste: boolean } & Record<string, unknown>;
      const original = (await window.desktopApi.settings.load()) as SettingsValue;
      const updated: SettingsValue = {
        ...original,
        autoOcrAfterPaste: !original.autoOcrAfterPaste,
      };
      const saved = (await window.desktopApi.settings.save(updated)) as SettingsValue;
      const reloaded = (await window.desktopApi.settings.load()) as SettingsValue;
      await window.desktopApi.settings.save(original);
      return {
        expected: updated.autoOcrAfterPaste,
        saved: saved.autoOcrAfterPaste,
        reloaded: reloaded.autoOcrAfterPaste,
      };
    });
    expect(settingsRoundTrip.saved).toBe(settingsRoundTrip.expected);
    expect(settingsRoundTrip.reloaded).toBe(settingsRoundTrip.expected);
  } finally {
    await application.close();
  }
});
