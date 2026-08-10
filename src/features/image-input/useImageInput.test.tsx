import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialImageStoreState, useImageStore } from "../../store/useImageStore";
import type { ImageItem } from "../../types/image";
import type { ImageInputDependencies } from "./useImageInput";
import { useImageInput } from "./useImageInput";

const loadedImage = {
  bytes: new Uint8Array([1]),
  displayName: "input.png",
  mimeType: "image/png" as const,
  sizeBytes: 1,
};

function imageItem(sourceType: ImageItem["sourceType"]): ImageItem {
  return {
    id: `${sourceType}-id`,
    displayName: "input.png",
    sourceType,
    mimeType: "image/png",
    width: 1,
    height: 1,
    rotation: 0,
    objectUrl: `blob:${sourceType}`,
    status: "ready",
    dirty: false,
  };
}

function createDependencies(): ImageInputDependencies {
  return {
    api: {
      files: {
        openImages: vi.fn().mockResolvedValue({
          ok: true,
          value: { images: [loadedImage], rejected: [] },
        }),
        saveText: vi.fn(),
        saveJson: vi.fn(),
      },
      clipboard: {
        readImage: vi.fn().mockResolvedValue({ ok: true, value: loadedImage }),
      },
    },
    prepareItem: vi
      .fn()
      .mockImplementation((_loaded, sourceType: ImageItem["sourceType"]) =>
        Promise.resolve(imageItem(sourceType)),
      ),
  };
}

function Harness({ dependencies }: { dependencies: ImageInputDependencies }) {
  const input = useImageInput(dependencies);
  return (
    <div>
      <button onClick={() => void input.openImages()}>open</button>
      <output>{input.notice?.message ?? "idle"}</output>
      <textarea aria-label="editor" />
    </div>
  );
}

describe("useImageInput", () => {
  beforeEach(() => {
    useImageStore.setState({ ...initialImageStoreState });
  });

  it("adds images selected through the main-process dialog", async () => {
    const dependencies = createDependencies();
    render(<Harness dependencies={dependencies} />);

    fireEvent.click(screen.getByRole("button", { name: "open" }));

    await waitFor(() => {
      expect(useImageStore.getState().items).toHaveLength(1);
    });
    expect(useImageStore.getState().items[0]?.sourceType).toBe("file");
    expect(screen.getByText("1件の画像を追加しました。")).toBeInTheDocument();
  });

  it("adds a clipboard image with Ctrl+V outside an editor", async () => {
    const dependencies = createDependencies();
    render(<Harness dependencies={dependencies} />);

    fireEvent.keyDown(window, { key: "v", ctrlKey: true });

    await waitFor(() => {
      expect(useImageStore.getState().items).toHaveLength(1);
    });
    expect(useImageStore.getState().items[0]?.sourceType).toBe("clipboard");
  });

  it("does not intercept Ctrl+V while editing text", () => {
    const dependencies = createDependencies();
    render(<Harness dependencies={dependencies} />);

    fireEvent.keyDown(screen.getByRole("textbox", { name: "editor" }), {
      key: "v",
      ctrlKey: true,
    });

    expect(dependencies.api?.clipboard.readImage).not.toHaveBeenCalled();
  });
});
