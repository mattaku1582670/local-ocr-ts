import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { initialImageStoreState, useImageStore } from "../store/useImageStore";
import { initialSettingsStoreState, useSettingsStore } from "../store/useSettingsStore";
import { App } from "./App";
import { AppProviders } from "./providers";

describe("App", () => {
  beforeEach(() => {
    useImageStore.setState({ ...initialImageStoreState });
    useSettingsStore.setState({ ...initialSettingsStoreState });
  });

  it("renders the three-pane workspace", () => {
    render(
      <AppProviders>
        <App />
      </AppProviders>,
    );

    expect(screen.getByRole("heading", { name: "画像一覧（0）" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "画像プレビュー" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "OCR結果" })).toBeInTheDocument();
  });

  it("shows the settings synchronization state", () => {
    render(
      <AppProviders>
        <App />
      </AppProviders>,
    );

    expect(screen.getByText("設定同期: idle")).toBeInTheDocument();
  });
});
