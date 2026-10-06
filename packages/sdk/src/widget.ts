export interface NoxHereReporter {
  id?: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  notifyOnResolution?: boolean;
}

export interface NoxHereWidgetApi {
  identify(reporter: NoxHereReporter | null): void;
  destroy?(): void;
}

export interface InstallNoxHereWidgetOptions {
  siteId: string;
  reporter?: NoxHereReporter | null;
  baseUrl?: string;
  nonce?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

declare global {
  interface Window {
    NoxSpot?: NoxHereWidgetApi;
    __NoxHereWidgetSiteId?: string;
  }
}

let pendingInstallation: { siteId: string; promise: Promise<NoxHereWidgetApi> } | undefined;

export async function installNoxHereWidget(options: InstallNoxHereWidgetOptions): Promise<NoxHereWidgetApi> {
  if (typeof document === "undefined" || typeof window === "undefined") throw new Error("The NoxHere widget requires a browser document");
  const siteId = options.siteId.trim();
  if (!siteId || siteId.length > 120) throw new Error("siteId must contain 1 to 120 characters");
  if (pendingInstallation) {
    if (pendingInstallation.siteId !== siteId) throw new Error(`The NoxHere widget is already loading for site ${pendingInstallation.siteId}`);
    const widget = await pendingInstallation.promise;
    if (options.reporter !== undefined) widget.identify(options.reporter);
    return widget;
  }
  if (window.NoxSpot) {
    if (window.__NoxHereWidgetSiteId !== siteId) {
      throw new Error("The NoxHere widget is already installed for a different or unknown site");
    }
    if (options.reporter !== undefined) window.NoxSpot.identify(options.reporter);
    return window.NoxSpot;
  }

  const baseUrl = new URL(options.baseUrl ?? "https://api.noxspot.dev");
  if (baseUrl.protocol !== "https:" && !(baseUrl.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(baseUrl.hostname))) {
    throw new Error("Widget baseUrl must use HTTPS (or HTTP on localhost)");
  }
  const source = new URL(`widget/${encodeURIComponent(siteId)}.js`, `${baseUrl.href.replace(/\/$/, "")}/`).href;
  const script = document.createElement("script");
  script.src = source;
  script.async = true;
  script.dataset.noxhereWidget = siteId;
  if (options.nonce) script.nonce = options.nonce;

  const promise = new Promise<NoxHereWidgetApi>((resolve, reject) => {
    const timeout = setTimeout(() => fail(new Error("NoxHere widget load timed out")), Math.max(250, Math.min(30_000, options.timeoutMs ?? 10_000)));
    const fail = (error: Error) => {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abort);
      script.remove();
      reject(error);
    };
    const abort = () => fail(new DOMException("Widget load aborted", "AbortError"));
    script.onload = () => {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abort);
      const widget = Reflect.get(window, "NoxSpot") as NoxHereWidgetApi | undefined;
      if (!widget) return fail(new Error("NoxHere widget loaded without registering its API"));
      window.__NoxHereWidgetSiteId = siteId;
      resolve(widget);
    };
    script.onerror = () => fail(new Error(`NoxHere widget failed to load from ${source}`));
    if (options.signal?.aborted) return abort();
    options.signal?.addEventListener("abort", abort, { once: true });
    document.head.appendChild(script);
  });
  pendingInstallation = { siteId, promise };
  try {
    const widget = await promise;
    if (options.reporter !== undefined) widget.identify(options.reporter);
    return widget;
  } finally {
    if (pendingInstallation?.promise === promise) pendingInstallation = undefined;
  }
}
