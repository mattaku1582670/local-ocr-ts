export interface DecodedPreviewSource {
  source: CanvasImageSource;
  width: number;
  height: number;
  dispose: () => void;
}

export interface PreviewDecoderDependencies {
  fetchBlob: (url: string) => Promise<Blob>;
  createBitmap?: (blob: Blob) => Promise<ImageBitmap>;
  loadHtmlImage: (url: string) => Promise<HTMLImageElement>;
}

function defaultLoadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.onerror = () => {
      reject(new Error("プレビュー画像をデコードできませんでした。"));
    };
    image.src = url;
  });
}

const defaultDependencies: PreviewDecoderDependencies = {
  fetchBlob: async (url) => (await fetch(url)).blob(),
  createBitmap:
    typeof createImageBitmap === "function"
      ? async (blob) => createImageBitmap(blob, { imageOrientation: "none" })
      : undefined,
  loadHtmlImage: defaultLoadHtmlImage,
};

export async function decodePreviewSource(
  objectUrl: string,
  dependencies: PreviewDecoderDependencies = defaultDependencies,
): Promise<DecodedPreviewSource> {
  if (dependencies.createBitmap) {
    try {
      const bitmap = await dependencies.createBitmap(await dependencies.fetchBlob(objectUrl));
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => {
          bitmap.close();
        },
      };
    } catch {
      // HTMLImageElement is the compatibility fallback for bitmap decode failures.
    }
  }
  const image = await dependencies.loadHtmlImage(objectUrl);
  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    dispose: () => undefined,
  };
}
