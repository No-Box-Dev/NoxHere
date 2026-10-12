/**
 * Debug logging — gated behind Feedback.init({ debug: true })
 */

let _debug = false;

export function setDebug(enabled) {
  _debug = !!enabled;
}

export function isDebugEnabled() {
  return _debug;
}

export function debugLog(...args) {
  if (_debug) console.log(...args);
}
