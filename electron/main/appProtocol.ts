import { net, protocol } from "electron";
import { isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const APPLICATION_SCHEME = "local-ocr";
export const APPLICATION_HOST = "app";
export const APPLICATION_URL = `${APPLICATION_SCHEME}://${APPLICATION_HOST}/`;

export function registerApplicationScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APPLICATION_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
        codeCache: true,
      },
    },
  ]);
}

export function registerApplicationProtocol(rendererDirectory: string): void {
  protocol.handle(APPLICATION_SCHEME, async (request) => {
    if (request.method !== "GET") return new Response(null, { status: 405 });
    const assetPath = resolveApplicationAssetPath(request.url, rendererDirectory);
    if (!assetPath) return new Response(null, { status: 404 });
    return net.fetch(pathToFileURL(assetPath).href);
  });
}

export function resolveApplicationAssetPath(
  requestUrl: string,
  rendererDirectory: string,
): string | null {
  const url = new URL(requestUrl);
  if (url.protocol !== `${APPLICATION_SCHEME}:` || url.host !== APPLICATION_HOST) return null;

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (decodedPath.includes("\0")) return null;

  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  const assetPath = resolve(rendererDirectory, relativePath);
  const pathFromRoot = relative(rendererDirectory, assetPath);
  if (pathFromRoot.startsWith("..") || isAbsolute(pathFromRoot)) return null;
  return assetPath;
}
