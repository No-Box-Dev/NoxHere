/**
 * DOM element detection and selector generation for annotations
 */

import { collectNearbyDataAttributes, shouldSkipDataAttr } from './capture.js';

/**
 * Check if a selector uniquely matches the given element
 * @param {string} selector - CSS selector to test
 * @param {Element} element - Element that should be the only match
 * @returns {boolean} True if selector matches only this element
 */
export function isUnique(selector, element) {
  try {
    const matches = document.querySelectorAll(selector);
    return matches.length === 1 && matches[0] === element;
  } catch (e) {
    return false;
  }
}

/**
 * Escape special characters in CSS selectors
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeSelector(str) {
  return str.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

/**
 * Generate a unique CSS selector for an element
 * @param {Element} element - DOM element
 * @returns {string} CSS selector that uniquely identifies the element
 */
export function generateSelector(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  // Try ID first (most specific)
  if (element.id) {
    const selector = `#${escapeSelector(element.id)}`;
    if (isUnique(selector, element)) {
      return selector;
    }
  }

  // Try tag + ID
  if (element.id) {
    const selector = `${element.tagName.toLowerCase()}#${escapeSelector(element.id)}`;
    if (isUnique(selector, element)) {
      return selector;
    }
  }

  // Try tag + classes
  if (element.classList.length > 0) {
    const classes = Array.from(element.classList)
      .filter(c => !c.startsWith('noxspot-')) // Ignore our own classes
      .map(c => `.${escapeSelector(c)}`)
      .join('');

    if (classes) {
      const selector = `${element.tagName.toLowerCase()}${classes}`;
      if (isUnique(selector, element)) {
        return selector;
      }
    }
  }

  // Try tag + data attributes
  const dataAttrs = Array.from(element.attributes)
    .filter(attr => attr.name.startsWith('data-'))
    .slice(0, 2); // Limit to 2 data attributes

  if (dataAttrs.length > 0) {
    const attrSelector = dataAttrs
      .map(attr => `[${attr.name}="${escapeSelector(attr.value)}"]`)
      .join('');
    const selector = `${element.tagName.toLowerCase()}${attrSelector}`;
    if (isUnique(selector, element)) {
      return selector;
    }
  }

  // Build path from ancestors
  const path = [];
  let current = element;

  while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
    let segment = current.tagName.toLowerCase();

    // Add ID if available
    if (current.id) {
      segment = `${segment}#${escapeSelector(current.id)}`;
      path.unshift(segment);
      break; // ID is unique enough, stop here
    }

    // Add nth-child for disambiguation
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        child => child.tagName === current.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        segment = `${segment}:nth-of-type(${index})`;
      }
    }

    path.unshift(segment);
    current = current.parentElement;

    // Try the path so far
    const selector = path.join(' > ');
    if (isUnique(selector, element)) {
      return selector;
    }

    // Limit path depth
    if (path.length >= 5) {
      break;
    }
  }

  return path.join(' > ') || element.tagName.toLowerCase();
}

/**
 * Extract useful information about an element
 * @param {Element} element - DOM element
 * @returns {Object} Element information
 */
export function extractElementInfo(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const info = {
    tagName: element.tagName.toLowerCase(),
    selector: generateSelector(element),
  };

  // Add ID if present
  if (element.id) {
    info.id = element.id;
  }

  // Add classes (excluding noxspot classes)
  const classes = Array.from(element.classList)
    .filter(c => !c.startsWith('noxspot-'));
  if (classes.length > 0) {
    info.classes = classes;
  }

  // Add visible text (truncated)
  const text = element.textContent?.trim();
  if (text && text.length > 0) {
    info.text = text.length > 100 ? text.substring(0, 100) + '...' : text;
  }

  // Add role/aria-label for accessibility elements
  if (element.getAttribute('role')) {
    info.role = element.getAttribute('role');
  }
  if (element.getAttribute('aria-label')) {
    info.ariaLabel = element.getAttribute('aria-label');
  }

  // Add href for links
  if (element.tagName === 'A' && element.href) {
    info.href = element.href;
  }

  // Add type for inputs
  if (element.tagName === 'INPUT') {
    info.inputType = element.type;
    if (element.name) info.name = element.name;
    if (element.placeholder) info.placeholder = element.placeholder;
  }

  // Add src for images
  if (element.tagName === 'IMG' && element.src) {
    info.src = element.src;
    if (element.alt) info.alt = element.alt;
  }

  // Collect data-* attributes on the element itself (filtered)
  const dataAttributes = {};
  for (const attr of element.attributes) {
    if (attr.name.startsWith('data-') && !shouldSkipDataAttr(attr.name)) {
      dataAttributes[attr.name] = attr.value;
    }
  }
  if (Object.keys(dataAttributes).length > 0) {
    info.dataAttributes = dataAttributes;
  }

  // Collect data-* attributes from ancestors and their children
  const ancestorData = collectNearbyDataAttributes(element);
  if (Object.keys(ancestorData).length > 0) {
    info.ancestorData = ancestorData;
  }

  return info;
}

// Recurse into same-origin iframes so the picker reports the element
// actually under the cursor instead of the iframe wrapper. Cross-origin
// iframes throw on contentDocument access — we keep the iframe element
// itself as the selection in that case.
function descendIntoIframe(element, x, y) {
  while (element && element.tagName === 'IFRAME') {
    let innerDoc = null;
    try { innerDoc = element.contentDocument; } catch { innerDoc = null; }
    if (!innerDoc) return element;
    const rect = element.getBoundingClientRect();
    const inner = innerDoc.elementFromPoint(x - rect.left, y - rect.top);
    if (!inner) return element;
    element = inner;
  }
  return element;
}

/**
 * Detect element at a point, temporarily hiding the overlay
 * @param {number} x - X coordinate (viewport)
 * @param {number} y - Y coordinate (viewport)
 * @param {Element} overlayElement - Overlay to temporarily hide
 * @returns {Element|null} Element at the point
 */
export function detectElementAtPoint(x, y, overlayElement) {
  if (!overlayElement) {
    return descendIntoIframe(document.elementFromPoint(x, y), x, y);
  }

  // Store original display
  const originalDisplay = overlayElement.style.display;

  // Hide overlay
  overlayElement.style.display = 'none';

  // Detect element
  const element = descendIntoIframe(document.elementFromPoint(x, y), x, y);

  // Restore overlay
  overlayElement.style.display = originalDisplay;

  return element;
}

/**
 * Detect elements for an annotation based on its type and coordinates
 * @param {Object} annotation - Annotation object with type and coordinates
 * @param {Element} overlayElement - Overlay to temporarily hide
 * @param {Object} captureState - Scroll position at capture time
 * @returns {Array} Array of element info objects
 */
export function detectElementsForAnnotation(annotation, overlayElement, captureState = {}) {
  const elements = [];
  const { scrollX = 0, scrollY = 0 } = captureState;

  // Calculate viewport coordinates from annotation coordinates
  // Annotation coords are relative to the captured image (document at capture time)
  // We need to convert to current viewport coords
  const toViewportX = (x) => x - scrollX;
  const toViewportY = (y) => y - scrollY;

  switch (annotation.type) {
    case 'arrow': {
      // Check element at arrow tip (end point)
      const tipX = toViewportX(annotation.endX);
      const tipY = toViewportY(annotation.endY);
      const tipElement = detectElementAtPoint(tipX, tipY, overlayElement);
      if (tipElement) {
        const info = extractElementInfo(tipElement);
        if (info) {
          info.annotationType = 'arrow-tip';
          elements.push(info);
        }
      }
      break;
    }

    case 'rectangle': {
      // Check element at center of rectangle
      const centerX = toViewportX(annotation.startX + (annotation.endX - annotation.startX) / 2);
      const centerY = toViewportY(annotation.startY + (annotation.endY - annotation.startY) / 2);
      const centerElement = detectElementAtPoint(centerX, centerY, overlayElement);
      if (centerElement) {
        const info = extractElementInfo(centerElement);
        if (info) {
          info.annotationType = 'rectangle-center';
          elements.push(info);
        }
      }
      break;
    }

    case 'text': {
      // Check element where text was placed
      const textX = toViewportX(annotation.x);
      const textY = toViewportY(annotation.y);
      const textElement = detectElementAtPoint(textX, textY, overlayElement);
      if (textElement) {
        const info = extractElementInfo(textElement);
        if (info) {
          info.annotationType = 'text-location';
          elements.push(info);
        }
      }
      break;
    }

    case 'freeform': {
      // Sample a few points along the path
      if (annotation.points && annotation.points.length > 0) {
        const samplePoints = [
          annotation.points[0],
          annotation.points[Math.floor(annotation.points.length / 2)],
          annotation.points[annotation.points.length - 1],
        ];

        const seen = new Set();
        for (const point of samplePoints) {
          const pointX = toViewportX(point.x);
          const pointY = toViewportY(point.y);
          const element = detectElementAtPoint(pointX, pointY, overlayElement);
          if (element) {
            const info = extractElementInfo(element);
            if (info && !seen.has(info.selector)) {
              seen.add(info.selector);
              info.annotationType = 'freeform-path';
              elements.push(info);
            }
          }
        }
      }
      break;
    }
  }

  return elements;
}
