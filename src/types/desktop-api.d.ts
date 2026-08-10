export {};

declare global {
  interface Window {
    desktopApi: {
      readonly versions: {
        readonly chrome: string;
        readonly electron: string;
      };
      readonly settings: {
        readonly load: () => Promise<unknown>;
        readonly save: (settings: unknown) => Promise<unknown>;
      };
      readonly files: {
        readonly openImages: () => Promise<unknown>;
        readonly saveText: (request: unknown) => Promise<unknown>;
        readonly saveJson: (request: unknown) => Promise<unknown>;
      };
      readonly clipboard: {
        readonly readImage: () => Promise<unknown>;
      };
    };
  }
}
