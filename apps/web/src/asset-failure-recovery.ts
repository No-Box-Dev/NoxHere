const RECOVERY_KEY = "noxhere.asset-recovery-at";
const RECOVERY_WINDOW_MS = 60_000;

type RecoveryOptions = {
  target?: Window;
  storage?: Pick<Storage, "getItem" | "setItem">;
  reload?: () => void;
  now?: () => number;
};

let recoveredWithoutStorage = false;

function recentRecovery(storage: RecoveryOptions["storage"], now: number): boolean {
  if (!storage) return recoveredWithoutStorage;
  try {
    const previous = Number(storage.getItem(RECOVERY_KEY));
    if (Number.isFinite(previous) && previous > 0 && now - previous < RECOVERY_WINDOW_MS) return true;
    storage.setItem(RECOVERY_KEY, String(now));
    return false;
  } catch {
    return recoveredWithoutStorage;
  }
}

export function installAssetFailureRecovery(options: RecoveryOptions = {}): () => void {
  const target = options.target ?? window;
  const storage = options.storage ?? (() => {
    try { return target.sessionStorage; } catch { return undefined; }
  })();
  const reload = options.reload ?? (() => target.location.reload());
  const now = options.now ?? Date.now;

  const recover = (event: Event) => {
    event.preventDefault();
    if (recentRecovery(storage, now())) return;
    if (!storage) recoveredWithoutStorage = true;
    reload();
  };
  const recoverImportError = (event: ErrorEvent) => {
    if (/importing a module script failed|failed to fetch dynamically imported module|error loading dynamically imported module/i.test(event.message)) {
      recover(event);
    }
  };

  target.addEventListener("vite:preloadError", recover);
  target.addEventListener("error", recoverImportError);
  return () => {
    target.removeEventListener("vite:preloadError", recover);
    target.removeEventListener("error", recoverImportError);
  };
}

export const assetFailureRecovery = {
  key: RECOVERY_KEY,
  windowMs: RECOVERY_WINDOW_MS,
};
