/**
 * Loader-only console capture and auto-error reporting.
 *
 * The buffer state lives here, and `startConsoleCapture` publishes a getter at
 * `window.__NoxSpotConsole.getLogs()`. The core bundle's `collectMetadata`
 * reads through that global so console history captured before the core loaded
 * still ends up in the report.
 */

import { getBrowser, getOS } from './env.js';

const consoleLogs = [];
const MAX_LOGS = 50;
let captureStarted = false;

let originalConsoleLog = null;
let originalConsoleWarn = null;
let originalConsoleError = null;
let errorHandler = null;
let rejectionHandler = null;

function addLogEntry(type, args) {
  const message = args.map((arg) => {
    if (typeof arg === 'object') {
      try { return JSON.stringify(arg); } catch { return String(arg); }
    }
    return String(arg);
  }).join(' ');

  if (message.startsWith('[NoxSpot]')) return;

  consoleLogs.push({
    type,
    message: message.substring(0, 500),
    timestamp: new Date().toISOString(),
  });
  if (consoleLogs.length > MAX_LOGS) consoleLogs.shift();
}

export function startConsoleCapture() {
  if (captureStarted) return;
  captureStarted = true;

  originalConsoleLog = console.log;
  console.log = function (...args) {
    addLogEntry('log', args);
    originalConsoleLog.apply(console, args);
  };

  originalConsoleWarn = console.warn;
  console.warn = function (...args) {
    addLogEntry('warn', args);
    originalConsoleWarn.apply(console, args);
  };

  originalConsoleError = console.error;
  console.error = function (...args) {
    addLogEntry('error', args);
    originalConsoleError.apply(console, args);
  };

  if (typeof window !== 'undefined') {
    errorHandler = (event) => {
      addLogEntry('uncaught', [event.message, `at ${event.filename}:${event.lineno}`]);
    };
    rejectionHandler = (event) => {
      addLogEntry('unhandled-promise', [event.reason?.message || String(event.reason)]);
    };
    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', rejectionHandler);
  }

  window.__NoxSpotConsole = { getLogs: () => [...consoleLogs] };
}

export function stopConsoleCapture() {
  if (!captureStarted) return;

  if (originalConsoleLog) console.log = originalConsoleLog;
  if (originalConsoleWarn) console.warn = originalConsoleWarn;
  if (originalConsoleError) console.error = originalConsoleError;

  if (typeof window !== 'undefined') {
    if (errorHandler) window.removeEventListener('error', errorHandler);
    if (rejectionHandler) window.removeEventListener('unhandledrejection', rejectionHandler);
  }

  originalConsoleLog = null;
  originalConsoleWarn = null;
  originalConsoleError = null;
  errorHandler = null;
  rejectionHandler = null;
  captureStarted = false;

  if (window.__NoxSpotConsole) delete window.__NoxSpotConsole;
}

/**
 * Auto-report uncaught errors to the NoxSpot API.
 * Queues errors and flushes every 5s or at 10 items.
 */
export function autoReportErrors(siteId, apiUrl) {
  const FLUSH_BATCH = 10;
  const FLUSH_TIMEOUT_MS = 5000;
  const MAX_QUEUE = 100;

  const queue = [];
  const reported = new Set();
  let flushTimer = null;
  let flushing = false;

  function fingerprint(msg, source) {
    return `${msg}|${source || ''}`;
  }

  async function flush() {
    if (flushing || queue.length === 0) return;
    flushing = true;
    const batch = queue.slice(0, FLUSH_BATCH);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FLUSH_TIMEOUT_MS);
      try {
        const response = await fetch(`${apiUrl}/errors`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteId, errors: batch }),
          signal: controller.signal,
        });
        // Only drop from the queue when the server accepted the batch;
        // transient failures keep the errors for the next flush attempt.
        if (response.ok) queue.splice(0, batch.length);
      } finally {
        clearTimeout(timer);
      }
    } catch {
      // Network error or abort — leave the batch in the queue to retry.
    } finally {
      flushing = false;
    }
  }

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flush();
    }, 5000);
  }

  function enqueue(errorData) {
    const fp = fingerprint(errorData.message, errorData.source);
    if (reported.has(fp)) return;
    reported.add(fp);

    errorData.url = window.location.href;
    errorData.browser = getBrowser();
    errorData.os = getOS();
    errorData.timestamp = new Date().toISOString();

    // Cap the queue so repeated network failures don't leak memory.
    if (queue.length >= MAX_QUEUE) queue.shift();
    queue.push(errorData);
    if (queue.length >= FLUSH_BATCH) flush();
    else scheduleFlush();
  }

  const onError = (event) => {
    if (event.message?.startsWith('[NoxSpot]')) return;
    enqueue({
      message: event.message || 'Unknown error',
      source: event.filename || null,
      lineno: event.lineno || null,
      colno: event.colno || null,
      stack: event.error?.stack || null,
    });
  };

  const onRejection = (event) => {
    const reason = event.reason;
    enqueue({
      message: reason?.message || String(reason) || 'Unhandled promise rejection',
      source: null,
      lineno: null,
      colno: null,
      stack: reason?.stack || null,
    });
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);

  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    flush();
  };
}
