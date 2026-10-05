/**
 * NoxSpot loader — the bundle every page loads.
 *
 * Always-loaded: trigger button, console/error capture, keyboard shortcut,
 * toast, submit POST, config fetch. The heavy bits (overlay, canvas, capture,
 * rasterize, annotation) live in the core bundle and load lazily the first
 * time the user clicks the trigger or fires the shortcut.
 */

import { injectLoaderStyles, removeLoaderStyles } from './loader-styles.js';
import { createTrigger, hideTrigger, showTrigger, destroyTrigger, updateTrigger } from './trigger.js';
import { startConsoleCapture, stopConsoleCapture, autoReportErrors } from './console-buffer.js';
import { setDebug, debugLog } from './debug.js';
import { showToast, dismissToast } from './toast.js';
import { hasBlock } from './utils.js';

const API_URL = 'https://api.noxspot.dev';
const CONFIG_TIMEOUT_MS = 3000;
const CORE_FILENAME = 'noxspot-core.min.js';

function isMac() {
  const plat = (navigator.userAgentData?.platform || navigator.platform || '').toLowerCase();
  return plat.includes('mac');
}

const DEFAULT_SHORTCUT = isMac() ? 'cmd+shift+s' : 'ctrl+shift+s';

// Default form layout used when the server returns no blocks (e.g. the
// site row predates migration 0013, or the request failed). Mirrors the
// migration's per-site backfill so day-zero behavior is unchanged.
const DEFAULT_BLOCKS = [
  { id: 'default-title', type: 'title', required: true },
  { id: 'default-description', type: 'description', required: true },
  { id: 'default-reporter', type: 'reporter', required: true },
  { id: 'default-category', type: 'category', required: false },
  { id: 'default-element-picker', type: 'element_picker', required: false },
  { id: 'default-metadata', type: 'metadata', required: false },
  { id: 'default-console-logs', type: 'console_logs', required: false },
];

const config = {
  siteId: null,
  color: '#FE795D',
  text: 'Report issue',
  getContext: null,
  shortcut: DEFAULT_SHORTCUT,
  members: [],
  blocks: DEFAULT_BLOCKS,
};

// Same env-scope rule as categories: NULL/empty environments means "all envs".
// When no env matched (matchedEnvName === null), only universal items pass.
export function filterByEnvironment(items, matchedEnvName) {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => {
    if (!item || !Array.isArray(item.environments) || item.environments.length === 0) return true;
    return matchedEnvName !== null && item.environments.includes(matchedEnvName);
  });
}

let autoErrorCleanup = null;
let shortcutCleanup = null;
let coreLoadPromise = null;
let coreUrl = null;

// document.currentScript is only reliable at top-level script execution. Capture
// the loader's src now so later callers (idle prefetch, click handlers) don't
// need to scan the DOM and guess. Falls back to script-tag scan inside
// resolveCoreUrl if this is null (e.g. loader injected dynamically).
const LOADER_SRC = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || null;

export { DEFAULT_BLOCKS };

export function isUrlMatch(configured) {
  if (!configured) return false;

  let host = '';
  let port = '';
  try {
    const parsed = new URL(configured.includes('://') ? configured : `http://${configured}`);
    host = parsed.hostname;
    port = parsed.port;
  } catch {
    host = String(configured).trim();
  }
  host = host.toLowerCase();
  if (!host) return false;

  const currentHost = window.location.hostname.toLowerCase();
  const currentPort = window.location.port;

  const hostMatches = currentHost === host || currentHost.endsWith('.' + host);
  if (!hostMatches) return false;

  if (port && port !== currentPort) return false;

  return true;
}

// The core bundle sits next to the loader on the same origin. Reading
// document.currentScript at init time is the standard way to discover that
// origin — works for R2 public URL, custom domains, and self-hosted mirrors.
function resolveCoreUrl() {
  if (coreUrl) return coreUrl;

  if (LOADER_SRC) {
    coreUrl = LOADER_SRC.replace(/[^/]+$/, CORE_FILENAME);
    return coreUrl;
  }

  // Fallback: scan script tags for anything that looks like our loader.
  // `.min` is optional so the non-minified dev build resolves too. `-core` is
  // excluded so an already-loaded core script isn't mistaken for the loader.
  // `blindspot.min.js` is matched too — legacy embeds (n1.care) still load
  // that filename and depend on it resolving the new core path.
  const scripts = document.querySelectorAll('script[src]');
  for (const s of scripts) {
    if (/(?:noxspot|blindspot)(?!-core)(\.[^/]+)?(\.min)?\.js(?:[?#]|$)/.test(s.src)) {
      coreUrl = s.src.replace(/[^/]+$/, CORE_FILENAME);
      return coreUrl;
    }
  }

  debugLog('[NoxSpot] Could not resolve core URL from script tags');
  return null;
}

function loadCore() {
  if (window.__NoxSpotCore) return Promise.resolve();
  if (coreLoadPromise) return coreLoadPromise;

  const url = resolveCoreUrl();
  if (!url) return Promise.reject(new Error('NoxSpot core URL unresolved'));

  coreLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = () => {
      if (window.__NoxSpotCore) {
        resolve();
      } else {
        // Registration failure — clear the promise so a retry can run again.
        coreLoadPromise = null;
        reject(new Error('NoxSpot core loaded but did not register'));
      }
    };
    script.onerror = () => {
      coreLoadPromise = null;
      reject(new Error('NoxSpot core failed to load from ' + url));
    };
    document.head.appendChild(script);
  });

  return coreLoadPromise;
}

function prefetchCore() {
  if (window.__NoxSpotCore) return;
  const url = resolveCoreUrl();
  if (!url) return;
  // Compare resolved hrefs directly — building a CSS selector from a URL
  // risks breaking on quotes or other selector metacharacters in the value.
  const existing = document.querySelectorAll('link[rel="prefetch"]');
  for (const link of existing) {
    if (link.href === url) return;
  }

  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.as = 'script';
  link.href = url;
  document.head.appendChild(link);
}

export function init(options = {}) {
  if (!options.siteId) {
    console.error('[NoxSpot] Missing required option: siteId');
    return;
  }

  // Re-entering init without an intervening destroy() would stack a second
  // shortcut listener and a second autoReportErrors handler. Clean up first.
  if (config.siteId) destroy();

  config.siteId = options.siteId;
  config.color = options.color || '#FE795D';
  config.text = options.text || 'Report issue';
  config.getContext = typeof options.getContext === 'function' ? options.getContext : null;
  if (options.shortcut !== undefined) config.shortcut = options.shortcut;

  setDebug(!!options.debug);

  startConsoleCapture();
  injectLoaderStyles();

  createTrigger(handleTrigger, {
    color: config.color,
    text: config.text,
    shortcut: formatShortcut(config.shortcut),
  });

  shortcutCleanup = attachShortcutListener();

  fetchConfig();
  fetchMembers();

  scheduleCorePrefetch();

  debugLog('[NoxSpot] Initialized', { siteId: config.siteId });
}

export function destroy() {
  stopConsoleCapture();
  if (autoErrorCleanup) {
    autoErrorCleanup();
    autoErrorCleanup = null;
  }
  if (shortcutCleanup) {
    shortcutCleanup();
    shortcutCleanup = null;
  }

  if (window.__NoxSpotCore) window.__NoxSpotCore.cleanup();

  destroyTrigger();
  removeLoaderStyles();

  config.siteId = null;
  config.color = '#FE795D';
  config.text = 'Report issue';
  config.getContext = null;
  config.shortcut = DEFAULT_SHORTCUT;
  config.autoErrorLogging = false;
  config.blocks = DEFAULT_BLOCKS;
}

function scheduleCorePrefetch() {
  const run = () => prefetchCore();
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(run, { timeout: 2000 });
  } else {
    setTimeout(run, 1500);
  }
}

async function fetchMembers() {
  try {
    const response = await fetch(`${API_URL}/sites/${config.siteId}/members`);
    if (!response.ok) return;
    const data = await response.json();
    if (Array.isArray(data?.members)) config.members = data.members;
  } catch (e) {
    debugLog('[NoxSpot] Members fetch failed:', e?.message || e);
  }
}

async function fetchConfig() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_URL}/sites/${config.siteId}/config`, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return;

    const data = await response.json();
    config.autoErrorLogging = !!data.autoErrorLogging;
    const rawCategories = Array.isArray(data.categories) ? data.categories : [];
    const rawBlocks = Array.isArray(data.blocks) ? data.blocks : [];

    const environments = data.environments || [];
    let matchedEnvName = null;
    if (environments.length > 0) {
      const matched = environments.find((env) => isUrlMatch(env.url));
      if (!matched) {
        debugLog('[NoxSpot] No environment matches current host, widget hidden');
        destroyTrigger();
        return;
      }
      if (matched.enabled === false) {
        debugLog('[NoxSpot] Environment is disabled, widget hidden:', matched.name);
        destroyTrigger();
        return;
      }
      matchedEnvName = matched.name;
      config.environment = matched.name;
      config.color = matched.buttonColor || config.color;
      config.text = matched.buttonText || config.text;
      updateTrigger({ color: config.color, text: config.text });
    }

    // Categories with an `environments` array are env-scoped. NULL/missing
    // means "all envs". When no env matched (no envs configured), all rules
    // pass through.
    config.categories = filterByEnvironment(rawCategories, matchedEnvName);

    // Blocks follow the same env-scope rule. If the server returns nothing
    // (older deploy, fetch hiccup), fall back so the widget still renders a
    // usable form.
    const filteredBlocks = filterByEnvironment(rawBlocks, matchedEnvName);
    config.blocks = filteredBlocks.length ? filteredBlocks : DEFAULT_BLOCKS;

    if (config.autoErrorLogging) {
      autoErrorCleanup = autoReportErrors(config.siteId, API_URL);
    }
  } catch (e) {
    clearTimeout(timer);
    debugLog('[NoxSpot] Config fetch failed, using defaults:', e?.message || e);
  }
}

function overlayCallbacks() {
  return {
    onClose: () => {
      showTrigger();
    },
    onSubmit: handleSubmit,
    getContext: config.getContext,
    members: config.members,
    categories: config.categories,
    blocks: config.blocks,
    onCaptureError: (error) => {
      console.error('[NoxSpot] Capture failed:', error);
      showToast({ message: 'Screenshot capture failed', variant: 'error', durationMs: 4000 });
    },
  };
}

async function handleTrigger() {
  debugLog('[NoxSpot] Starting capture mode (optimistic)...');

  releaseInputZoom();
  hideTrigger();

  try {
    await loadCore();
  } catch (error) {
    console.error('[NoxSpot]', error);
    showToast({ message: 'Widget failed to load', variant: 'error', durationMs: 4000 });
    showTrigger();
    return;
  }

  window.__NoxSpotCore.open({
    mode: 'click',
    callbacks: overlayCallbacks(),
  });
}

function releaseInputZoom() {
  const active = document.activeElement;
  if (active && typeof active.blur === 'function' && active !== document.body) {
    active.blur();
  }
  if (window.visualViewport && window.visualViewport.scale > 1) {
    window.scrollTo(window.scrollX, window.scrollY);
  }
}

async function handleShortcut() {
  debugLog('[NoxSpot] Shortcut triggered, capturing before overlay...');

  releaseInputZoom();
  hideTrigger();

  showToast({ message: 'Capturing…', variant: 'success', durationMs: 10000 });

  try {
    await loadCore();
  } catch (error) {
    console.error('[NoxSpot]', error);
    showToast({ message: 'Widget failed to load', variant: 'error', durationMs: 4000 });
    showTrigger();
    return;
  }

  window.__NoxSpotCore.open({
    mode: 'shortcut',
    callbacks: overlayCallbacks(),
    onCaptureReady: () => dismissToast(),
    onCaptureFailed: (error) => {
      console.error('[NoxSpot] Capture failed:', error);
      showToast({ message: 'Screenshot capture failed', variant: 'error', durationMs: 4000 });
      showTrigger();
    },
  });
}

function formatShortcut(spec) {
  const combo = parseShortcut(spec);
  if (!combo) return '';
  const parts = [];
  if (combo.meta) parts.push('⌘');
  if (combo.ctrl) parts.push(isMac() ? '⌃' : 'Ctrl');
  if (combo.alt) parts.push(isMac() ? '⌥' : 'Alt');
  if (combo.shift) parts.push('⇧');
  if (combo.key) parts.push(combo.key.toUpperCase());
  return parts.join(isMac() ? '' : '+');
}

function parseShortcut(spec) {
  if (!spec || typeof spec !== 'string') return null;
  const parts = spec.toLowerCase().split('+').map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return null;

  const combo = { alt: false, shift: false, ctrl: false, meta: false, key: '' };
  for (const part of parts) {
    if (part === 'alt' || part === 'option') combo.alt = true;
    else if (part === 'shift') combo.shift = true;
    else if (part === 'ctrl' || part === 'control') combo.ctrl = true;
    else if (part === 'meta' || part === 'cmd' || part === 'command') combo.meta = true;
    else combo.key = part;
  }
  if (!combo.key) return null;
  return combo;
}

function attachShortcutListener() {
  const combo = parseShortcut(config.shortcut);
  if (!combo) return null;

  const handler = (event) => {
    if (!!event.altKey !== combo.alt) return;
    if (!!event.shiftKey !== combo.shift) return;
    if (!!event.ctrlKey !== combo.ctrl) return;
    if (!!event.metaKey !== combo.meta) return;
    const eventKey = (event.key || '').toLowerCase();
    if (eventKey !== combo.key) return;

    event.preventDefault();
    event.stopPropagation();
    handleShortcut();
  };

  window.addEventListener('keydown', handler, true);
  return () => window.removeEventListener('keydown', handler, true);
}

// Pure for testability — every input the body needs is passed in. The handler
// resolves blocks/siteId/environment from `config` at call time.
export function buildSubmitBody(data, ctx) {
  const blocks = ctx.blocks;
  const includeMetadata = hasBlock(blocks, 'metadata');
  const includeConsoleLogs = hasBlock(blocks, 'console_logs');
  const includeElements = hasBlock(blocks, 'element_picker');

  // Even when the metadata block is hidden, the screenshot rasterizer
  // depends on viewport dimensions captured upstream — only the user-
  // visible / submitted metadata is suppressed here.
  let metadataPayload = null;
  if (includeMetadata && data.metadata) {
    if (includeConsoleLogs) {
      metadataPayload = data.metadata;
    } else {
      const { consoleErrors: _omit, ...rest } = data.metadata;
      metadataPayload = rest;
    }
  }

  return {
    siteId: ctx.siteId,
    title: data.title,
    description: data.description,
    reporter: data.reporter,
    category: data.category || null,
    environment: ctx.environment || null,
    screenshot: data.screenshot,
    metadata: metadataPayload,
    elements: includeElements ? data.elements : [],
    context: data.context || null,
    blockValues: data.blockValues || null,
  };
}

async function sendReport(body) {
  const response = await fetch(`${API_URL}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let message = `Server error (${response.status})`;
    let code = null;
    try {
      const result = await response.json();
      if (result?.error) message = result.error;
      if (result?.code) code = result.code;
    } catch {
      // ignore — keep default message
    }
    const err = new Error(message);
    err.status = response.status;
    err.code = code;
    throw err;
  }
  return response.json().catch(() => ({}));
}

function openIssueAction(issueUrl) {
  // Only open if the response looks like a real https URL — defensive against
  // a malformed payload. The toast renders the value as a button label only,
  // never as innerHTML.
  if (typeof issueUrl !== 'string' || !/^https:\/\//.test(issueUrl)) return null;
  return {
    label: 'View in GitHub →',
    onClick: () => window.open(issueUrl, '_blank', 'noopener,noreferrer'),
  };
}

function handleSubmit(data) {
  debugLog('[NoxSpot] Submitting report (optimistic)...');

  if (window.__NoxSpotCore) window.__NoxSpotCore.close();
  showTrigger();

  showToast({ message: 'Sending…', variant: 'success', durationMs: 0 });

  const body = buildSubmitBody(data, {
    siteId: config.siteId,
    environment: config.environment,
    blocks: config.blocks,
  });

  sendReport(body)
    .then((result) => {
      debugLog('[NoxSpot] Report submitted successfully', result);
      showToast({
        message: 'Reported ✓',
        variant: 'success',
        durationMs: 6000,
        action: openIssueAction(result?.issueUrl),
      });
    })
    .catch((error) => {
      console.error('[NoxSpot] Submit failed:', error);
      showToast({
        message: 'Report failed to send',
        variant: 'error',
        durationMs: 8000,
        action: {
          label: 'Retry',
          onClick: () => retrySubmit(body),
        },
      });
    });
}

function retrySubmit(body) {
  showToast({ message: 'Retrying…', variant: 'success', durationMs: 0 });
  sendReport(body)
    .then((result) => {
      showToast({
        message: 'Reported ✓',
        variant: 'success',
        durationMs: 6000,
        action: openIssueAction(result?.issueUrl),
      });
    })
    .catch((error) => {
      console.error('[NoxSpot] Retry failed:', error);
      showToast({
        message: 'Still failing — check your connection',
        variant: 'error',
        durationMs: 8000,
        action: {
          label: 'Retry',
          onClick: () => retrySubmit(body),
        },
      });
    });
}
