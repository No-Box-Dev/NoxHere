/**
 * Core bundle entry — registers window.__FeedbackCore for the loader to call.
 *
 * Loader owns the trigger, toast, console capture, config fetch, shortcut, and
 * submit POST. Core owns the overlay, capture, annotation canvas, and element
 * picker. The two communicate through the single global __FeedbackCore.
 */

import { injectStyles } from './styles.js';
import { captureScreenshot } from './capture.js';
import { showOverlay, hideOverlay } from './overlay.js';
import { hasBlock } from './utils.js';
import { waitForHostDomStable } from './stability.js';

let stylesInjected = false;
let openGeneration = 0;

function ensureStyles() {
  if (stylesInjected) return;
  injectStyles();
  stylesInjected = true;
}

/**
 * Open the capture flow.
 *
 * @param {Object} args
 * @param {'click' | 'shortcut'} args.mode - Both paths capture before mounting
 *   the overlay so the widget cannot alter the page it is photographing.
 * @param {Object} args.callbacks - onClose, onSubmit, onCaptureError,
 *   getContext, members. Passed through to the overlay unchanged.
 * @param {() => void} [args.onCaptureReady] - Fires when the capture promise
 *   resolves in shortcut mode. Loader uses this to dismiss the "Capturing…"
 *   toast before the overlay appears.
 * @param {(error: Error) => void} [args.onCaptureFailed] - Fires when capture
 *   rejects in shortcut mode. Loader restores the trigger and shows an error.
 */
function open({ callbacks, onCaptureReady, onCaptureFailed }) {
  ensureStyles();
  const generation = ++openGeneration;
  const capture = () => captureScreenshot({ includeElementMap: hasBlock(callbacks?.blocks, 'element_picker') });

  // A host app can report readyState=complete while its framework is still
  // hydrating or waiting for its first API response. Observe a bounded DOM
  // settling window before cloning, and do not mount our overlay until the
  // clone has started so Feedback itself can never enter the screenshot.
  waitForHostDomStable()
    .then(() => {
      if (generation !== openGeneration) return;
      return capture().then((result) => {
        if (generation !== openGeneration) return;
        if (onCaptureReady) onCaptureReady();
        showOverlay(Promise.resolve(result), callbacks);
      });
    })
    .catch((error) => {
      if (generation !== openGeneration) return;
      if (onCaptureFailed) onCaptureFailed(error);
    });
}

function close() {
  openGeneration += 1;
  hideOverlay();
}

function cleanup() {
  openGeneration += 1;
  hideOverlay();
  const style = document.getElementById('feedback-styles');
  if (style) style.remove();
  stylesInjected = false;
}

window.__FeedbackCore = { open, close, cleanup };
