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
  }
}

export async function installNoxHereWidget(options: InstallNoxHereWidgetOptions): Promise<NoxHereWidgetApi> {
  if (typeof document === "undefined" || typeof window === "undefined") throw new Error("The NoxHere widget requires a browser document");
  const siteId = options.siteId.trim();
  if (!siteId || siteId.length > 120) throw new Error("siteId must contain 1 to 120 characters");
  if (window.NoxSpot) {
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

  await new Promise<void>((resolve, reject) => {
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
      if (window.NoxSpot) resolve();
      else fail(new Error("NoxHere widget loaded without registering its API"));
    };
    script.onerror = () => fail(new Error(`NoxHere widget failed to load from ${source}`));
    if (options.signal?.aborted) return abort();
    options.signal?.addEventListener("abort", abort, { once: true });
    document.head.appendChild(script);
  });

  const widget = Reflect.get(window, "NoxSpot") as NoxHereWidgetApi | undefined;
  if (!widget) throw new Error("NoxHere widget API is unavailable");
  if (options.reporter !== undefined) widget.identify(options.reporter);
  return widget;
}
