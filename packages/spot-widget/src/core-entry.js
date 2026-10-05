/**
 * Core bundle entry — registers window.__NoxSpotCore for the loader to call.
 *
 * Loader owns the trigger, toast, console capture, config fetch, shortcut, and
 * submit POST. Core owns the overlay, capture, annotation canvas, and element
 * picker. The two communicate through the single global __NoxSpotCore.
 */

import { injectStyles } from './styles.js';
import { captureScreenshot } from './capture.js';
import { showOverlay, hideOverlay } from './overlay.js';

let stylesInjected = false;

function ensureStyles() {
  if (stylesInjected) return;
  injectStyles();
  stylesInjected = true;
}

/**
 * Open the capture flow.
 *
 * @param {Object} args
 * @param {'click' | 'shortcut'} args.mode - click opens overlay first, then
 *   captures inside it. shortcut captures first (to preserve transient UI like
 *   open dropdowns) then opens the overlay with the resolved capture.
 * @param {Object} args.callbacks - onClose, onSubmit, onCaptureError,
 *   getContext, members. Passed through to the overlay unchanged.
 * @param {() => void} [args.onCaptureReady] - Fires when the capture promise
 *   resolves in shortcut mode. Loader uses this to dismiss the "Capturing…"
 *   toast before the overlay appears.
 * @param {(error: Error) => void} [args.onCaptureFailed] - Fires when capture
 *   rejects in shortcut mode. Loader restores the trigger and shows an error.
 */
function open({ mode, callbacks, onCaptureReady, onCaptureFailed }) {
  ensureStyles();

  if (mode === 'click') {
    showOverlay(captureScreenshot(), callbacks);
    return;
  }

  // Shortcut path: capture must finish before the overlay mounts, so that
  // transient UI (open <select>, menus) is still visible when we rasterize.
  captureScreenshot()
    .then((capture) => {
      if (onCaptureReady) onCaptureReady();
      showOverlay(Promise.resolve(capture), callbacks);
    })
    .catch((error) => {
      if (onCaptureFailed) onCaptureFailed(error);
    });
}

function close() {
  hideOverlay();
}

function cleanup() {
  hideOverlay();
  const style = document.getElementById('noxspot-styles');
  if (style) style.remove();
  stylesInjected = false;
}

window.__NoxSpotCore = { open, close, cleanup };
