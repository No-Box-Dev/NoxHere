/**
 * Auto-collect metadata about the page and environment.
 *
 * Console history lives in the loader bundle (see console-buffer.js); we read
 * it here through `window.__NoxSpotConsole` so reports include errors that
 * occurred before the core bundle loaded.
 */

import { getBrowser, getOS, extractUrlEntities } from './env.js';

function getRecentConsoleLogs() {
  return window.__NoxSpotConsole?.getLogs?.() ?? [];
}

export function collectMetadata() {
  return {
    url: window.location.href,
    browser: getBrowser(),
    os: getOS(),
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    screenSize: `${window.screen.width}x${window.screen.height}`,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    consoleErrors: getRecentConsoleLogs(),
    urlEntities: extractUrlEntities(),
  };
}

export { getBrowser, getOS, extractUrlEntities };
