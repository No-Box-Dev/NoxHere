const DEFAULT_MIN_WAIT_MS = 700;
const DEFAULT_QUIET_MS = 250;
const DEFAULT_MAX_WAIT_MS = 3_000;

const LOADING_SELECTOR = [
  '[aria-busy="true"]',
  '[role="progressbar"]',
  '[role="status"][aria-label*="load" i]',
  '[data-loading="true"]',
  '[class*="skeleton" i]',
].join(',');

function hasHostLoadingIndicator() {
  try {
    return [...document.querySelectorAll(LOADING_SELECTOR)]
      .some((node) => !node.closest('.noxspot-overlay, .noxspot-trigger, .noxspot-toast'));
  } catch {
    return false;
  }
}

function nextPaint() {
  if (typeof requestAnimationFrame !== 'function') return Promise.resolve();
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

/**
 * Give client-rendered host applications a bounded chance to finish their
 * initial render before NoxSpot clones the page. `document.readyState` is not
 * sufficient for React/Vue/etc: their data-driven render commonly happens
 * after the document is already `complete`.
 *
 * The minimum observation window catches a delayed first render, the quiet
 * window catches follow-up DOM work, and the hard deadline ensures animated
 * or continuously updating pages can never prevent feedback from opening.
 */
export function waitForHostDomStable(options = {}) {
  const minWaitMs = options.minWaitMs ?? DEFAULT_MIN_WAIT_MS;
  const quietMs = options.quietMs ?? DEFAULT_QUIET_MS;
  const maxWaitMs = Math.max(options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS, minWaitMs);

  if (!document.body || typeof MutationObserver === 'undefined') {
    return new Promise((resolve) => setTimeout(resolve, minWaitMs)).then(nextPaint);
  }

  return new Promise((resolve) => {
    const startedAt = performance.now();
    let lastMutationAt = startedAt;
    let settled = false;
    let checkTimer;
    let deadlineTimer;

    const finish = () => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(checkTimer);
      clearTimeout(deadlineTimer);
      resolve();
    };

    const scheduleCheck = () => {
      clearTimeout(checkTimer);
      const now = performance.now();
      const minRemaining = Math.max(0, minWaitMs - (now - startedAt));
      const quietRemaining = Math.max(0, quietMs - (now - lastMutationAt));
      checkTimer = setTimeout(() => {
        const checkedAt = performance.now();
        const hostIsLoading = hasHostLoadingIndicator();
        if (
          checkedAt - startedAt >= minWaitMs &&
          checkedAt - lastMutationAt >= quietMs &&
          !hostIsLoading
        ) {
          finish();
        } else {
          checkTimer = setTimeout(scheduleCheck, hostIsLoading ? 100 : 0);
        }
      }, Math.max(minRemaining, quietRemaining));
    };

    const observer = new MutationObserver(() => {
      lastMutationAt = performance.now();
      scheduleCheck();
    });
    observer.observe(document.body, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    });

    scheduleCheck();
    deadlineTimer = setTimeout(finish, maxWaitMs);
  }).then(nextPaint);
}
