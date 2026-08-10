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
    };
  }
}
