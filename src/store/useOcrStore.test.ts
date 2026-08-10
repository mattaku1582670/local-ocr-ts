import { beforeEach, describe, expect, it } from "vitest";
import { initialOcrStoreState, useOcrStore } from "./useOcrStore";

describe("useOcrStore", () => {
  beforeEach(() => {
    useOcrStore.setState({
      ...initialOcrStoreState,
      queue: [],
      progressByImageId: {},
    });
  });

  it("queues unique image IDs in FIFO order", () => {
    useOcrStore.getState().enqueueMany(["first", "second", "first", ""]);

    expect(useOcrStore.getState().queue).toEqual(["first", "second"]);
    expect(useOcrStore.getState().startNext()).toBe("first");
    expect(useOcrStore.getState().queue).toEqual(["second"]);
    expect(useOcrStore.getState().startNext()).toBeNull();
  });

  it("clamps progress and completes the active item", () => {
    useOcrStore.getState().enqueue("first");
    useOcrStore.getState().startNext();
    useOcrStore.getState().setProgress("first", { percent: 150, stage: "recognizing" });

    expect(useOcrStore.getState().progressByImageId.first.percent).toBe(100);

    useOcrStore.getState().completeActive();
    expect(useOcrStore.getState().activeImageId).toBeNull();
    expect(useOcrStore.getState().progressByImageId.first).toEqual({
      percent: 100,
      stage: "complete",
    });
  });

  it("cancels queued and active items", () => {
    useOcrStore.getState().enqueueMany(["first", "second"]);
    useOcrStore.getState().startNext();
    useOcrStore.getState().cancel("first");
    useOcrStore.getState().cancel("second");

    expect(useOcrStore.getState().activeImageId).toBeNull();
    expect(useOcrStore.getState().queue).toEqual([]);
    expect(useOcrStore.getState().progressByImageId).toEqual({});
  });

  it("tracks engine errors and resets runtime state", () => {
    useOcrStore.getState().setEngineStatus("error", {
      code: "OCR_INITIALIZATION_FAILED",
      message: "初期化に失敗しました。",
      recoverable: true,
    });
    useOcrStore.getState().enqueue("first");

    useOcrStore.getState().reset();

    expect(useOcrStore.getState()).toMatchObject(initialOcrStoreState);
  });
});
