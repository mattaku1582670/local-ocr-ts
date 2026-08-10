import { useCallback, useEffect, useState } from "react";
import { useImageStore } from "../../store/useImageStore";
import type { ImageItem } from "../../types/image";
import {
  loadDroppedFile,
  parseClipboardResponse,
  parseOpenImagesResponse,
  prepareImageItem,
  type LoadedImage,
} from "./imageInput";

export interface InputNotice {
  message: string;
  tone: "info" | "success" | "warning";
}

export interface ImageInputDependencies {
  api?: Pick<Window["desktopApi"], "clipboard" | "files">;
  loadFile?: typeof loadDroppedFile;
  prepareItem?: typeof prepareImageItem;
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : "画像を追加できませんでした。";
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.matches("input, textarea, select");
}

export function useImageInput(dependencies: ImageInputDependencies = {}) {
  const api =
    dependencies.api ?? (typeof window.desktopApi === "object" ? window.desktopApi : undefined);
  const loadFile = dependencies.loadFile ?? loadDroppedFile;
  const prepareItem = dependencies.prepareItem ?? prepareImageItem;
  const addImages = useImageStore((state) => state.addImages);
  const [notice, setNotice] = useState<InputNotice | null>(null);
  const [busy, setBusy] = useState(false);

  const addLoadedImages = useCallback(
    async (images: LoadedImage[], sourceType: ImageItem["sourceType"]): Promise<number> => {
      const settled = await Promise.allSettled(
        images.map(async (image) => prepareItem(image, sourceType)),
      );
      const items = settled.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      addImages(items);
      return items.length;
    },
    [addImages, prepareItem],
  );

  const openImages = useCallback(async () => {
    if (busy) return;
    if (!api) {
      setNotice({ tone: "warning", message: "デスクトップAPIを利用できません。" });
      return;
    }
    setBusy(true);
    try {
      const payload = parseOpenImagesResponse(await api.files.openImages());
      const added = await addLoadedImages(payload.images, "file");
      if (added === 0 && payload.rejected.length === 0) return;
      setNotice(
        payload.rejected.length > 0
          ? {
              tone: "warning",
              message: `${String(added)}件追加、${String(payload.rejected.length)}件は追加できませんでした。${payload.rejected[0]?.message ?? ""}`,
            }
          : { tone: "success", message: `${String(added)}件の画像を追加しました。` },
      );
    } catch (error) {
      setNotice({ tone: "warning", message: messageFrom(error) });
    } finally {
      setBusy(false);
    }
  }, [addLoadedImages, api, busy]);

  const pasteImage = useCallback(async () => {
    if (busy) return;
    if (!api) {
      setNotice({ tone: "warning", message: "デスクトップAPIを利用できません。" });
      return;
    }
    setBusy(true);
    try {
      const loaded = parseClipboardResponse(await api.clipboard.readImage());
      if (!loaded) {
        setNotice({ tone: "info", message: "クリップボードに画像がありません。" });
        return;
      }
      const added = await addLoadedImages([loaded], "clipboard");
      setNotice({ tone: "success", message: `${String(added)}件の画像を貼り付けました。` });
    } catch (error) {
      setNotice({ tone: "warning", message: messageFrom(error) });
    } finally {
      setBusy(false);
    }
  }, [addLoadedImages, api, busy]);

  const dropFiles = useCallback(
    async (files: File[]) => {
      if (busy || files.length === 0) return;
      setBusy(true);
      try {
        const settled = await Promise.allSettled(files.map(loadFile));
        const loaded = settled.flatMap((result) =>
          result.status === "fulfilled" ? [result.value] : [],
        );
        const errors = settled.flatMap((result) =>
          result.status === "rejected" ? [messageFrom(result.reason)] : [],
        );
        const added = await addLoadedImages(loaded, "file");
        setNotice(
          errors.length > 0
            ? {
                tone: "warning",
                message: `${String(added)}件追加、${String(errors.length)}件は追加できませんでした。${errors[0]}`,
              }
            : { tone: "success", message: `${String(added)}件の画像を追加しました。` },
        );
      } finally {
        setBusy(false);
      }
    },
    [addLoadedImages, busy, loadFile],
  );

  useEffect(() => {
    const onPasteShortcut = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.altKey || event.key.toLocaleLowerCase("en-US") !== "v") return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      void pasteImage();
    };
    window.addEventListener("keydown", onPasteShortcut);
    return () => {
      window.removeEventListener("keydown", onPasteShortcut);
    };
  }, [pasteImage]);

  return { busy, dropFiles, notice, openImages, pasteImage };
}
