export {};

declare global {
  interface Window {
    desktopApi: {
      readonly versions: {
        readonly chrome: string;
        readonly electron: string;
      };
    };
  }
}
