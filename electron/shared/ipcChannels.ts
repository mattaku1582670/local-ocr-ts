export const IPC_CHANNELS = Object.freeze({
  app: Object.freeze({
    getVersion: "app:get-version",
  }),
  clipboard: Object.freeze({
    readImage: "clipboard:read-image",
    writeText: "clipboard:write-text",
  }),
  file: Object.freeze({
    openImages: "file:open-images",
    readImage: "file:read-image",
    saveText: "file:save-text",
    saveJson: "file:save-json",
  }),
  settings: Object.freeze({
    load: "settings:load",
    save: "settings:save",
  }),
});

type NestedValue<T> = T extends Record<string, infer Value> ? Value : never;
export type IpcChannel = NestedValue<NestedValue<typeof IPC_CHANNELS>>;
