import { describe, expect, it } from "vitest";
import { openImagesRequestSchema, parseIpcInput, saveTextRequestSchema } from "./schemas.js";

describe("IPC input schemas", () => {
  it("accepts a supported image extension list", () => {
    expect(parseIpcInput(openImagesRequestSchema, { extensions: ["png", "jpg"] })).toEqual({
      extensions: ["png", "jpg"],
    });
  });

  it.each([
    { extensions: [] },
    { extensions: ["svg"] },
    { extensions: ["png"], unexpected: true },
    "png",
    null,
  ])("rejects malformed open-images input: %j", (input) => {
    expect(() => parseIpcInput(openImagesRequestSchema, input)).toThrow();
  });

  it("rejects an empty default save name", () => {
    expect(() =>
      parseIpcInput(saveTextRequestSchema, { defaultFileName: " ", text: "result" }),
    ).toThrow();
  });
});
