import { describe, expect, it } from "vitest";
import { isNavigationAllowed } from "./security.js";

describe("isNavigationAllowed", () => {
  it("allows reloading the current renderer URL", () => {
    const currentUrl = "file:///C:/LocalOCR/resources/app.asar/dist/index.html";
    expect(isNavigationAllowed(currentUrl, currentUrl)).toBe(true);
  });

  it.each([
    "https://example.com/",
    "file:///C:/Windows/System32/drivers/etc/hosts",
    "javascript:alert(1)",
  ])("rejects navigation to %s", (targetUrl) => {
    const currentUrl = "file:///C:/LocalOCR/resources/app.asar/dist/index.html";
    expect(isNavigationAllowed(currentUrl, targetUrl)).toBe(false);
  });
});
