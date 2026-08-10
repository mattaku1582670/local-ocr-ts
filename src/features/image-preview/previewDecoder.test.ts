import { describe, expect, it, vi } from "vitest";
import { decodePreviewSource, type PreviewDecoderDependencies } from "./previewDecoder";

function htmlImage(): HTMLImageElement {
  return { naturalWidth: 320, naturalHeight: 200 } as HTMLImageElement;
}

describe("decodePreviewSource", () => {
  it("prefers ImageBitmap and closes it on dispose", async () => {
    const close = vi.fn();
    const bitmap = { width: 640, height: 480, close } as unknown as ImageBitmap;
    const dependencies: PreviewDecoderDependencies = {
      fetchBlob: vi.fn().mockResolvedValue(new Blob()),
      createBitmap: vi.fn().mockResolvedValue(bitmap),
      loadHtmlImage: vi.fn().mockResolvedValue(htmlImage()),
    };

    const decoded = await decodePreviewSource("blob:image", dependencies);
    decoded.dispose();

    expect(decoded).toMatchObject({ source: bitmap, width: 640, height: 480 });
    expect(dependencies.loadHtmlImage).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
  });

  it("falls back to HTMLImageElement when bitmap decode fails", async () => {
    const image = htmlImage();
    const dependencies: PreviewDecoderDependencies = {
      fetchBlob: vi.fn().mockResolvedValue(new Blob()),
      createBitmap: vi.fn().mockRejectedValue(new Error("unsupported")),
      loadHtmlImage: vi.fn().mockResolvedValue(image),
    };

    await expect(decodePreviewSource("blob:image", dependencies)).resolves.toMatchObject({
      source: image,
      width: 320,
      height: 200,
    });
    expect(dependencies.loadHtmlImage).toHaveBeenCalledWith("blob:image");
  });
});
