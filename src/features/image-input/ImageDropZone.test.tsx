import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ImageDropZone } from "./ImageDropZone";

describe("ImageDropZone", () => {
  it("passes all dropped files to the input handler", () => {
    const onDropFiles = vi.fn();
    const files = [
      new File(["a"], "first.png", { type: "image/png" }),
      new File(["b"], "second.jpg", { type: "image/jpeg" }),
    ];
    render(<ImageDropZone onDropFiles={onDropFiles} onOpen={vi.fn()} />);

    fireEvent.drop(screen.getByRole("button", { name: "画像をドロップまたは選択" }), {
      dataTransfer: { files },
    });

    expect(onDropFiles).toHaveBeenCalledWith(files);
  });

  it("opens the file picker from the keyboard", () => {
    const onOpen = vi.fn();
    render(<ImageDropZone onDropFiles={vi.fn()} onOpen={onOpen} />);

    fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });

    expect(onOpen).toHaveBeenCalledOnce();
  });
});
