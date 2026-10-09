/**
 * Screenshot capture — rasterizes the viewport via rasterize.js (in-house
 * foreignObject engine) and builds an element map for the annotation picker.
 */

import { debugLog } from './debug.js';
import { captureViewport } from './rasterize.js';

const ELEMENT_MAP_NODE_LIMIT = 5_000;
const ELEMENT_MAP_ENTRY_LIMIT = 750;
const ELEMENT_MAP_TIME_LIMIT_MS = 750;
const NEARBY_DESCENDANT_LIMIT = 80;

let nearbyDataCache = new WeakMap();

function now() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

/**
 * Capture a screenshot of the current viewport and an element map for
 * hit-testing in the annotation overlay.
 *
 * @param {{ includeElementMap?: boolean }} [options]
 * @returns {Promise<{ dataUrl: string|null, elementMap: Array, viewport: { width: number, height: number }, captureError?: { code: string, message: string } }>}
 */
export async function captureScreenshot(options = {}) {
  debugLog('[NoxSpot] Capturing screenshot...');

  // Hide the trigger button during capture so it doesn't appear in the image.
  const trigger = document.querySelector('.noxspot-trigger');
  if (trigger) trigger.style.visibility = 'hidden';

  let elementMap = [];
  try {
    // Capture element positions BEFORE rasterizing so coordinates match the
    // exact layout the screenshot captures.
    if (options.includeElementMap !== false) elementMap = captureElementMap();

    const { dataUrl, viewport } = await captureViewport({
      filter: (node) => {
        if (!node.classList) return true;
        return !(
          node.classList.contains('noxspot-overlay') ||
          node.classList.contains('noxspot-trigger') ||
          node.classList.contains('noxspot-toast')
        );
      },
    });

    debugLog('[NoxSpot] Screenshot captured', {
      size: Math.round(dataUrl.length / 1024) + 'kb',
      elements: elementMap.length,
    });

    return { dataUrl, elementMap, viewport };
  } catch (error) {
    // Capture is an enhancement to the report, never a prerequisite for it.
    // Returning a bounded fallback keeps the feedback form usable on pages
    // whose DOM is too large or contains browser-specific rasterization traps.
    const message = error instanceof Error ? error.message : String(error);
    debugLog('[NoxSpot] Screenshot unavailable; continuing without it', { message });
    return {
      dataUrl: null,
      elementMap: [],
      viewport: { width: window.innerWidth, height: window.innerHeight },
      captureError: {
        code: error?.code || 'capture_failed',
        message: message.slice(0, 300),
      },
    };
  } finally {
    if (trigger) trigger.style.visibility = 'visible';
  }
}

/**
 * Capture bounding boxes of all visible elements
 * @returns {Array} Array of { rect, tagName, id, classes, text, selector }
 */
export function captureElementMap() {
  const elements = [];
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const state = {
    visited: 0,
    startedAt: now(),
    exhausted: false,
    rects: new WeakMap(),
  };
  nearbyDataCache = new WeakMap();

  walkDocument(document, window, 0, 0, '', elements, viewportWidth, viewportHeight, state);

  // Sort by area (smallest first) so smaller elements are checked first during hover
  elements.sort((a, b) => (a.rect.width * a.rect.height) - (b.rect.width * b.rect.height));

  debugLog('[NoxSpot] Element map captured:', elements.length, 'elements', {
    visited: state.visited,
    truncated: state.exhausted,
  });
  return elements;
}

/**
 * Walk a document, collecting visible elements with their rects translated to
 * top-page viewport coords. Recurses into same-origin iframes; cross-origin
 * iframes are skipped silently (the iframe wrapper itself is still picked).
 *
 * @param {Document} doc - The document to walk
 * @param {Window} win - The window for that document (for getComputedStyle)
 * @param {number} offsetX - Cumulative iframe offset in top viewport coords
 * @param {number} offsetY - Cumulative iframe offset in top viewport coords
 * @param {string} framePath - Human-readable path of iframe ancestors (empty for top doc)
 * @param {Array} elements - Output array to push element infos into
 * @param {number} viewportWidth
 * @param {number} viewportHeight
 */
function walkDocument(doc, win, offsetX, offsetY, framePath, elements, viewportWidth, viewportHeight, state) {
  if (!doc || !doc.body) return;

  const childIframes = [];

  const walker = doc.createTreeWalker(
    doc.body,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => {
        state.visited += 1;
        if (
          state.visited > ELEMENT_MAP_NODE_LIMIT ||
          elements.length >= ELEMENT_MAP_ENTRY_LIMIT ||
          now() - state.startedAt > ELEMENT_MAP_TIME_LIMIT_MS
        ) {
          state.exhausted = true;
          return NodeFilter.FILTER_REJECT;
        }

        // Skip noxspot elements
        if (node.classList?.contains('noxspot-trigger')) return NodeFilter.FILTER_REJECT;

        // Reject off-screen table rows as a subtree. A large table can contain
        // tens of thousands of cells, none of which can be selected when its
        // row is outside the captured viewport.
        const localRect = node.getBoundingClientRect();
        state.rects.set(node, localRect);
        const top = localRect.top + offsetY;
        const bottom = localRect.bottom + offsetY;
        const left = localRect.left + offsetX;
        const right = localRect.right + offsetX;
        const outside = bottom < 0 || top > viewportHeight || right < 0 || left > viewportWidth;
        if (outside && node.tagName === 'TR') return NodeFilter.FILTER_REJECT;
        if (outside) return NodeFilter.FILTER_SKIP;

        // Check actual visibility only after the inexpensive viewport test.
        // getComputedStyle can force layout and was previously called for
        // every off-screen table cell.
        const style = win.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  let node;
  while (node = walker.nextNode()) {
    if (state.exhausted || elements.length >= ELEMENT_MAP_ENTRY_LIMIT) break;
    if (node.tagName === 'IFRAME') childIframes.push(node);

    const localRect = state.rects.get(node) || node.getBoundingClientRect();
    // Translate to top-page viewport coords. getBoundingClientRect inside an
    // iframe is relative to that iframe's own viewport (and already accounts
    // for inner scroll), so adding the cumulative iframe offset yields the
    // position the rasterized screenshot will show.
    const rect = {
      left: localRect.left + offsetX,
      top: localRect.top + offsetY,
      right: localRect.right + offsetX,
      bottom: localRect.bottom + offsetY,
      width: localRect.width,
      height: localRect.height,
    };

    // Skip elements outside viewport or too small
    if (rect.width < 5 || rect.height < 5) continue;
    if (rect.bottom < 0 || rect.top > viewportHeight) continue;
    if (rect.right < 0 || rect.left > viewportWidth) continue;

    // Get element info
    const tagName = node.tagName.toLowerCase();
    const id = node.id || null;
    const classes = node.className && typeof node.className === 'string'
      ? node.className.split(' ').filter(c => c && !c.startsWith('noxspot-'))
      : [];

    // Get computed styles for visual context
    const styles = win.getComputedStyle(node);
    const backgroundColor = styles.backgroundColor;
    const color = styles.color;

    // Get text content (direct text only, not children)
    let text = '';
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.textContent;
      }
    }
    text = text.trim().substring(0, 150);

    // Get full inner text for context (truncated)
    const innerText = node.innerText?.trim().substring(0, 200) || '';

    // Build a simple selector
    let selector = tagName;
    if (id) {
      selector = `${tagName}#${id}`;
    } else if (classes.length > 0) {
      selector = `${tagName}.${classes.slice(0, 2).join('.')}`;
    }

    // Build full unique CSS selector path
    const fullSelector = getFullSelector(node);

    // Collect filtered data-* attributes (useful for finding components in code)
    const dataAttributes = {};
    for (const attr of node.attributes) {
      if (attr.name.startsWith('data-') && !shouldSkipDataAttr(attr.name)) {
        dataAttributes[attr.name] = attr.value;
      }
    }

    // Get accessible name (what assistive tech sees)
    const accessibleName = getAccessibleName(node);

    // Get nearby landmark/context
    const context = getNearbyContext(node);

    // Collect data-* attrs from ancestors and their children
    const ancestorData = collectNearbyDataAttributes(node);

    // Build element info object
    const elementInfo = {
      rect: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      },
      tagName,
      id,
      classes,
      text,
      innerText,
      selector,
      fullSelector,
      dataAttributes,
      ancestorData,
      accessibleName,
      context,
      source: resolveElementSource(node),
      styles: {
        backgroundColor: backgroundColor !== 'rgba(0, 0, 0, 0)' ? backgroundColor : null,
        color,
      },
    };

    // Add type-specific attributes
    if (tagName === 'a' && node.href) {
      elementInfo.href = node.href;
    }
    if (tagName === 'img') {
      elementInfo.src = node.src;
      elementInfo.alt = node.alt;
    }
    if (tagName === 'input' || tagName === 'button' || tagName === 'select' || tagName === 'textarea') {
      elementInfo.type = node.type;
      elementInfo.name = node.name;
      elementInfo.placeholder = node.placeholder;
      // Skip sensitive input types to avoid capturing passwords/credit cards
      const sensitiveTypes = ['password', 'hidden', 'credit-card'];
      if (!sensitiveTypes.includes(node.type)) {
        elementInfo.value = node.value?.substring(0, 100);
      }
    }
    if (node.getAttribute('aria-label')) {
      elementInfo.ariaLabel = node.getAttribute('aria-label');
    }
    if (node.getAttribute('role')) {
      elementInfo.role = node.getAttribute('role');
    }
    if (framePath) {
      elementInfo.framePath = framePath;
    }

    // Build bounded source metadata directly. Reading outerHTML first and
    // truncating afterwards serializes an entire table subtree into a large
    // temporary string.
    elementInfo.html = openingTagSnapshot(node);

    elements.push(elementInfo);
  }

  // Recurse into same-origin iframes. contentDocument throws on cross-origin
  // access, so the try/catch keeps cross-origin frames from breaking capture —
  // the iframe wrapper itself was already added above.
  for (const iframe of childIframes) {
    if (state.exhausted || elements.length >= ELEMENT_MAP_ENTRY_LIMIT) break;
    let innerDoc = null;
    try { innerDoc = iframe.contentDocument; } catch { innerDoc = null; }
    if (!innerDoc) continue;
    const innerWin = innerDoc.defaultView;
    if (!innerWin) continue;

    const iframeRect = iframe.getBoundingClientRect();
    let host = '';
    try { host = new URL(iframe.src || iframe.baseURI || '', win.location.href).host; } catch {}
    const childPath = framePath
      ? `${framePath} > iframe[${host}]`
      : `iframe[${host}]`;

    walkDocument(
      innerDoc,
      innerWin,
      offsetX + iframeRect.left,
      offsetY + iframeRect.top,
      childPath,
      elements,
      viewportWidth,
      viewportHeight,
      state,
    );
  }
}

function escapeAttribute(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function openingTagSnapshot(node) {
  try {
    const tag = node.tagName.toLowerCase();
    const parts = [];
    let length = tag.length + 2;
    for (const attr of node.attributes) {
      if (/^(value|srcdoc)$/i.test(attr.name)) continue;
      const piece = ` ${attr.name}="${escapeAttribute(attr.value)}"`;
      if (length + piece.length > 1_000) {
        parts.push(' data-noxspot-truncated="true"');
        break;
      }
      parts.push(piece);
      length += piece.length;
    }
    return `<${tag}${parts.join('')}>`;
  } catch {
    return null;
  }
}

/**
 * Build a full unique CSS selector path for an element
 * @param {Element} el
 * @returns {string}
 */
function getFullSelector(el) {
  const parts = [];
  let current = el;

  while (current && current !== document.body && current !== document.documentElement) {
    let part = current.tagName.toLowerCase();

    if (current.id) {
      // ID is unique, stop here
      part = `#${current.id}`;
      parts.unshift(part);
      break;
    }

    // Add classes (first 2 for brevity)
    const classes = Array.from(current.classList)
      .filter(c => !c.startsWith('noxspot-'))
      .slice(0, 2);
    if (classes.length) {
      part += '.' + classes.join('.');
    }

    // Add nth-child if needed for uniqueness
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        part += `:nth-of-type(${index})`;
      }
    }

    parts.unshift(part);
    current = current.parentElement;
  }

  return parts.join(' > ');
}

/**
 * Get the accessible name of an element (what screen readers announce)
 * @param {Element} el
 * @returns {string|null}
 */
function getAccessibleName(el) {
  // Priority order for accessible name
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;

  const ariaLabelledBy = el.getAttribute('aria-labelledby');
  if (ariaLabelledBy) {
    const labelEl = document.getElementById(ariaLabelledBy);
    if (labelEl) return labelEl.textContent?.trim();
  }

  const title = el.getAttribute('title');
  if (title) return title;

  // For inputs, check associated label
  if (el.id) {
    const label = document.querySelector(`label[for="${el.id}"]`);
    if (label) return label.textContent?.trim();
  }

  // For buttons/links, use text content
  if (['BUTTON', 'A'].includes(el.tagName)) {
    return el.textContent?.trim().substring(0, 100) || null;
  }

  // For images, use alt
  if (el.tagName === 'IMG') {
    return el.alt || null;
  }

  return null;
}

/**
 * Get nearby context/landmarks to help locate the element
 * @param {Element} el
 * @returns {string|null}
 */
function getNearbyContext(el) {
  const contexts = [];

  // Check for landmark ancestors
  let current = el.parentElement;
  let depth = 0;
  while (current && depth < 5) {
    const role = current.getAttribute('role');
    const tag = current.tagName.toLowerCase();

    // Check for semantic landmarks
    if (['header', 'nav', 'main', 'aside', 'footer', 'section', 'article'].includes(tag)) {
      const label = current.getAttribute('aria-label') || current.id || '';
      contexts.push(label ? `${tag}[${label}]` : tag);
    } else if (role && ['banner', 'navigation', 'main', 'complementary', 'contentinfo', 'region'].includes(role)) {
      contexts.push(`[role=${role}]`);
    }

    // Check for data-testid or data-component on parents
    const testId = current.getAttribute('data-testid') || current.getAttribute('data-component');
    if (testId) {
      contexts.push(`[data-testid=${testId}]`);
    }

    current = current.parentElement;
    depth++;
  }

  // Check position in list if applicable
  const listParent = el.closest('ul, ol');
  if (listParent) {
    const items = Array.from(listParent.children).filter(c => c.tagName === 'LI');
    const listItem = el.closest('li');
    if (listItem && items.includes(listItem)) {
      const index = items.indexOf(listItem) + 1;
      contexts.push(`list item ${index} of ${items.length}`);
    }
  }

  return contexts.length > 0 ? contexts.join(' > ') : null;
}

// React attaches Fibers to DOM nodes under a key like __reactFiber$abc123.
// The suffix is stable for the page load, so we discover it once and cache.
const FRAMEWORK_SOURCE_PATTERN = /[\/\\]node_modules[\/\\]|^webpack|^rsc:/;
let reactFiberKey = null;

/**
 * Resolve a DOM node to its originating source file + line by walking the
 * React Fiber tree. Works only on dev builds (_debugSource is stripped in
 * prod). Returns null for non-React apps, RSCs, or framework-internal
 * components — the capture must never throw here.
 *
 * @param {Element} node
 * @returns {{ file: string, line: number, column: number } | null}
 */
export function resolveElementSource(node) {
  try {
    if (!reactFiberKey) {
      reactFiberKey = Object.keys(node).find(k =>
        k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')
      ) || null;
      if (!reactFiberKey) return null;
    }
    let fiber = node[reactFiberKey];
    // If the cached key doesn't hit on this node, it isn't React-managed.
    // React's suffix is stable per page load, so a miss here is a real miss —
    // no need to rescan Object.keys on every non-React element in the capture loop.
    if (!fiber) return null;
    // Cap the walk to guard against cyclic fiber graphs we've seen in the
    // wild (rare, but would hang capture). 50 hops is well past any realistic
    // user-component depth while framework internals bail out far sooner.
    let hops = 0;
    while (fiber && hops < 50) {
      const src = fiber._debugSource;
      if (src && src.fileName && !FRAMEWORK_SOURCE_PATTERN.test(src.fileName)) {
        return {
          file: stripSourcePath(src.fileName),
          line: src.lineNumber || 0,
          column: src.columnNumber || 0,
        };
      }
      fiber = fiber.return;
      hops++;
    }
  } catch {
    // Never break capture — fall through to null.
  }
  return null;
}

// Absolute paths like `/Users/dev/app/src/components/Foo.tsx` → `src/components/Foo.tsx`.
// Picks the deepest `/src/`, `/app/`, or `/pages/` marker so Docker-style
// `/app/` roots don't swallow a nested `/src/`. Windows dev paths use
// backslashes, so we normalize to forward slashes before matching.
function stripSourcePath(fileName) {
  const normalized = fileName.replace(/\\/g, '/');
  const markers = ['/src/', '/app/', '/pages/'];
  let bestIdx = -1;
  for (const marker of markers) {
    const idx = normalized.lastIndexOf(marker);
    if (idx > bestIdx) bestIdx = idx;
  }
  return bestIdx >= 0 ? normalized.slice(bestIdx + 1) : normalized;
}

// Exact attributes to skip (framework/UI noise)
const SKIP_DATA_ATTRS = new Set([
  'data-testid', 'data-state', 'data-slot', 'data-orientation',
  'data-disabled', 'data-highlighted', 'data-side', 'data-align',
  'data-tour', 'data-index', 'data-variant', 'data-size', 'data-discover',
]);

// Prefix patterns to skip (browser extensions, framework internals)
const SKIP_DATA_PREFIXES = [
  'data-radix-', 'data-dashlane-', 'data-1p-', 'data-lp',
  'data-sentry-', 'data-noxspot',
];

/**
 * Check if a data attribute should be skipped (noise from frameworks/extensions)
 */
export function shouldSkipDataAttr(name) {
  if (SKIP_DATA_ATTRS.has(name)) return true;
  for (const prefix of SKIP_DATA_PREFIXES) {
    if (name.startsWith(prefix)) return true;
  }
  return false;
}

/**
 * Collect data-* attributes from ancestor elements and all elements within their subtree
 * Walks up the DOM from the given element, collecting useful data attributes
 * For the first few ancestor levels, searches all descendants (catches buttons inside table cells)
 * @param {Element} element - Starting element
 * @param {number} maxDepth - Max ancestor levels to walk (default 6)
 * @returns {Object} Flat object of { "data-attr-name": "value" } — closest wins
 */
export function collectNearbyDataAttributes(element, maxDepth = 6) {
  const result = {};
  let current = element?.parentElement;
  let depth = 0;

  while (current && current !== document.body && current !== document.documentElement && depth < maxDepth) {
    // Collect from ancestor itself
    collectDataAttrsFrom(current, result);

    // Search a bounded number of nearby descendants and cache the result for
    // each ancestor. Previously every cell rescanned the complete tbody/table,
    // making long tables approach quadratic work.
    if (depth < 2) {
      let nearby = nearbyDataCache.get(current);
      if (!nearby) {
        nearby = {};
        const walker = current.ownerDocument.createTreeWalker(current, NodeFilter.SHOW_ELEMENT);
        let descendant;
        let visited = 0;
        while ((descendant = walker.nextNode()) && visited < NEARBY_DESCENDANT_LIMIT) {
          visited += 1;
          if (descendant.className && typeof descendant.className === 'string' && descendant.className.includes('noxspot')) continue;
          collectDataAttrsFrom(descendant, nearby);
        }
        nearbyDataCache.set(current, nearby);
      }
      for (const [name, value] of Object.entries(nearby)) {
        if (!(name in result)) result[name] = value;
      }
    }

    current = current.parentElement;
    depth++;
  }

  return result;
}

/**
 * Collect data-* attributes from a single element into the result object
 * Only sets if key is not already present (closest value wins)
 */
function collectDataAttrsFrom(el, result) {
  for (const attr of el.attributes) {
    if (!attr.name.startsWith('data-')) continue;
    if (shouldSkipDataAttr(attr.name)) continue;
    // Closest value wins — don't overwrite
    if (!(attr.name in result)) {
      result[attr.name] = attr.value;
    }
  }
}
