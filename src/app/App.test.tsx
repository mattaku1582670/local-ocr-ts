import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "../store/useAppStore";
import { App } from "./App";
import { AppProviders } from "./providers";

describe("App", () => {
  beforeEach(() => {
    useAppStore.setState({ completedRuns: 0 });
  });

  it("renders the three-pane workspace", () => {
    render(
      <AppProviders>
        <App />
      </AppProviders>,
    );

    expect(screen.getByRole("heading", { name: "画像一覧" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "画像プレビュー" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "OCR結果" })).toBeInTheDocument();
  });

  it("updates Zustand state from the UI", () => {
    render(
      <AppProviders>
        <App />
      </AppProviders>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Store動作確認" }));

    expect(screen.getByText("完了回数: 1")).toBeInTheDocument();
  });
});
