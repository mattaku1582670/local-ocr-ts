import { create } from "zustand";
import type { AppError } from "../types/errors";
import type { ImageItem, ImageRotation } from "../types/image";
import type { OcrDocument } from "../types/ocr";

export interface ImageStoreState {
  items: ImageItem[];
  selectedImageId: string | null;
  addImages: (items: ImageItem[]) => void;
  selectImage: (id: string | null) => void;
  removeImage: (id: string) => void;
  clearImages: () => void;
  setRotation: (id: string, rotation: ImageRotation) => void;
  setOcrResult: (id: string, result: OcrDocument) => void;
  setImageError: (id: string, error: AppError) => void;
  editOcrText: (id: string, editedText: string) => void;
  markSaved: (id: string) => void;
}

export const initialImageStoreState = {
  items: [] as ImageItem[],
  selectedImageId: null as string | null,
};

function revokeObjectUrl(item: ImageItem): void {
  URL.revokeObjectURL(item.objectUrl);
}

export const useImageStore = create<ImageStoreState>((set, get) => ({
  ...initialImageStoreState,
  addImages: (newItems) => {
    const knownIds = new Set(get().items.map((item) => item.id));
    const uniqueItems = newItems.filter((item) => {
      if (knownIds.has(item.id)) return false;
      knownIds.add(item.id);
      return true;
    });
    if (uniqueItems.length === 0) return;
    set((state) => ({
      items: [...state.items, ...uniqueItems],
      selectedImageId: state.selectedImageId ?? uniqueItems[0].id,
    }));
  },
  selectImage: (id) => {
    if (id !== null && !get().items.some((item) => item.id === id)) return;
    set({ selectedImageId: id });
  },
  removeImage: (id) => {
    const state = get();
    const removed = state.items.find((item) => item.id === id);
    if (!removed) return;
    revokeObjectUrl(removed);
    const removedIndex = state.items.findIndex((item) => item.id === id);
    const items = state.items.filter((item) => item.id !== id);
    set({
      items,
      selectedImageId:
        state.selectedImageId === id
          ? (items[Math.min(removedIndex, items.length - 1)]?.id ?? null)
          : state.selectedImageId,
    });
  },
  clearImages: () => {
    get().items.forEach(revokeObjectUrl);
    set({ ...initialImageStoreState });
  },
  setRotation: (id, rotation) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, rotation, dirty: item.ocrResult ? true : item.dirty } : item,
      ),
    }));
  },
  setOcrResult: (id, result) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id
          ? { ...item, ocrResult: result, status: "success", error: undefined, dirty: true }
          : item,
      ),
    }));
  },
  setImageError: (id, error) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, error, status: "error" } : item,
      ),
    }));
  },
  editOcrText: (id, editedText) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id && item.ocrResult
          ? { ...item, ocrResult: { ...item.ocrResult, editedText }, dirty: true }
          : item,
      ),
    }));
  },
  markSaved: (id) => {
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? { ...item, dirty: false } : item)),
    }));
  },
}));

export const selectSelectedImage = (state: ImageStoreState): ImageItem | undefined =>
  state.items.find((item) => item.id === state.selectedImageId);

export const selectHasDirtyImages = (state: ImageStoreState): boolean =>
  state.items.some((item) => item.dirty);
