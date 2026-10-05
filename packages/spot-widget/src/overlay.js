/**
 * Fullscreen overlay for annotation and form
 */

import { createSidebarHTML, initSidebarEvents, updateSelectedElements } from './sidebar.js';
import { collectMetadata } from './metadata.js';
import { escapeHtml, hasBlock } from './utils.js';
import { createToolbarHTML, initToolbar, destroyToolbar } from './toolbar.js';
import { initCanvas, destroyCanvas, hasAnnotations, getCanvasDataURL, disableCanvas, enableCanvas } from './canvas.js';
import { debugLog } from './debug.js';

let overlayElement = null;
let screenshotData = null;
let elementMapData = null;
let viewportData = null;
let metadataCache = null;
let getContextFn = null;
let onCloseCallback = null;
let onSubmitCallback = null;
let selectedElements = [];
let elementPickerActive = false;
let highlightOverlay = null;
let mobileStep = 1;
let lastTouchedElement = null;
let pickerImageLoadHandler = null;
let previouslyFocusedElement = null;
let capturePromise = null;
let captureReady = false;
let originalViewportMeta = null;
let viewportMetaAdded = false;

/**
 * Show the overlay. Accepts a capture object or a Promise resolving to one —
 * when given a Promise, the overlay renders immediately with a loading state
 * and hydrates the image + element map once the capture resolves.
 * @param {Object|Promise} captureOrPromise - { dataUrl, elementMap, viewport } or Promise<...>
 * @param {Object} options - Options
 * @param {Function} options.onClose - Callback when overlay is closed
 * @param {Function} options.onSubmit - Callback when form is submitted
 * @param {Function} [options.onCaptureError] - Called if the capture promise rejects
 */
export function showOverlay(captureOrPromise, options = {}) {
  if (overlayElement) return;

  const isPromise = captureOrPromise && typeof captureOrPromise.then === 'function';
  capturePromise = isPromise ? captureOrPromise : Promise.resolve(captureOrPromise);
  captureReady = false;

  getContextFn = options.getContext || null;
  onCloseCallback = options.onClose;
  onSubmitCallback = options.onSubmit;

  // Collect metadata
  metadataCache = collectMetadata();

  const isMobile = window.matchMedia('(max-width: 767px)').matches;

  overlayElement = document.createElement('div');
  overlayElement.className = 'noxspot-overlay';
  if (isMobile) overlayElement.classList.add('noxspot-mobile');

  overlayElement.innerHTML = `
    <div class="noxspot-overlay-backdrop"></div>
    <div class="noxspot-overlay-content">
      <div class="noxspot-toolbar">
        <div class="noxspot-toolbar-tools noxspot-toolbar-tools--disabled">
          ${createToolbarHTML({ showElementPicker: hasBlock(options.blocks, 'element_picker') })}
        </div>
        <button class="noxspot-close-btn" aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="noxspot-main">
        <div class="noxspot-canvas-area">
          <div class="noxspot-canvas-loading">
            <div class="noxspot-spinner" aria-hidden="true"></div>
            <div class="noxspot-canvas-loading-text">Capturing screenshot…</div>
          </div>
          <div class="noxspot-canvas-wrapper" style="display:none">
            <img class="noxspot-screenshot" alt="Screenshot" />
            <canvas class="noxspot-drawing-canvas"></canvas>
            <div class="noxspot-selected-highlights"></div>
            <div class="noxspot-element-highlight-overlay"></div>
          </div>
        </div>
        <div class="noxspot-sidebar">
          ${createSidebarHTML({
            blocks: options.blocks,
            metadata: metadataCache,
            onSubmit: handleFormSubmit,
            screenshotDataUrl: null,
            members: options.members,
            categories: options.categories,
          })}
        </div>
      </div>
    </div>
  `;

  // Mobile: add Continue button + floating close button (top-right)
  if (isMobile) {
    const nextBtn = document.createElement('button');
    nextBtn.className = 'noxspot-mobile-next';
    nextBtn.textContent = 'Continue';
    nextBtn.addEventListener('click', () => setMobileStep(2));
    overlayElement.querySelector('.noxspot-overlay-content').appendChild(nextBtn);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'noxspot-mobile-close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
    closeBtn.addEventListener('click', hideOverlay);
    overlayElement.querySelector('.noxspot-overlay-content').appendChild(closeBtn);
  }

  // Add event listeners
  overlayElement.querySelector('.noxspot-close-btn').addEventListener('click', hideOverlay);
  overlayElement.querySelector('.noxspot-overlay-backdrop').addEventListener('click', hideOverlay);

  // Save focus and trap it inside overlay
  previouslyFocusedElement = document.activeElement;
  document.addEventListener('keydown', handleKeyDown);

  // Handle resize / orientation change
  window.addEventListener('resize', handleResize);

  document.body.appendChild(overlayElement);
  document.body.style.overflow = 'hidden';

  // Lock the viewport at 1x so the overlay matches the visible area on mobile.
  // Without this, iOS can leave the page zoomed from an input focus, and our
  // 100vw/100dvh sizing anchors to the (zoomed) layout viewport — buttons end
  // up off-screen and the screenshot overflows the visible width.
  lockViewportZoom();

  // Pin overlay dimensions to the actual visual viewport, not the layout
  // viewport. Listen for visualViewport resizes (keyboard open, zoom) so the
  // overlay stays in sync.
  syncOverlayDimensions();
  window.visualViewport?.addEventListener('resize', syncOverlayDimensions);
  window.visualViewport?.addEventListener('scroll', syncOverlayDimensions);

  // Initialize components after DOM is ready
  setTimeout(() => {
    if (!overlayElement) return; // Closed before setTimeout fired
    // Initialize toolbar with tool change handler (kept disabled until capture resolves)
    const toolbarContainer = overlayElement.querySelector('.noxspot-toolbar-tools');
    initToolbar(toolbarContainer, {
      onToolChange: handleToolChange,
    });

    // Initialize sidebar form events
    initSidebarEvents();

    // Mobile: wire up back button and start on step 1
    if (isMobile) {
      const backBtn = overlayElement.querySelector('.noxspot-mobile-back');
      if (backBtn) {
        backBtn.style.display = '';
        backBtn.addEventListener('click', () => setMobileStep(1));
      }
      setMobileStep(1);
    }
  }, 0);

  // Hydrate the overlay once the screenshot + element map are ready
  capturePromise.then((capture) => {
    if (!overlayElement || !capture) return;
    hydrateCapture(capture);
  }).catch((err) => {
    if (!overlayElement) return;
    const errCb = options.onCaptureError;
    hideOverlay();
    if (errCb) errCb(err);
  });

  debugLog('[NoxSpot] Overlay opened (awaiting capture)');
}

/**
 * Swap the loading state for the real screenshot + element map.
 */
function hydrateCapture(capture) {
  screenshotData = capture.dataUrl;
  elementMapData = capture.elementMap;
  viewportData = capture.viewport;
  captureReady = true;

  const loading = overlayElement.querySelector('.noxspot-canvas-loading');
  const wrapper = overlayElement.querySelector('.noxspot-canvas-wrapper');
  const img = overlayElement.querySelector('.noxspot-screenshot');
  const canvas = overlayElement.querySelector('.noxspot-drawing-canvas');
  const toolbarTools = overlayElement.querySelector('.noxspot-toolbar-tools');
  const thumbImg = overlayElement.querySelector('.noxspot-mobile-thumbnail img');
  const thumbContainer = overlayElement.querySelector('.noxspot-mobile-thumbnail');

  if (thumbImg) thumbImg.src = capture.dataUrl;
  if (thumbContainer && overlayElement.classList.contains('noxspot-mobile') && mobileStep === 2) {
    thumbContainer.style.display = '';
  }

  let hydrated = false;
  let hydrateTimer = null;
  const finishHydrate = () => {
    if (hydrated) return;
    hydrated = true;
    if (hydrateTimer) { clearTimeout(hydrateTimer); hydrateTimer = null; }
    // Fall back to viewport dims if the image never produced natural dimensions —
    // keeps annotation coordinates sensible instead of a zero-size canvas.
    canvas.width = img.naturalWidth || viewportData?.width || 0;
    canvas.height = img.naturalHeight || viewportData?.height || 0;
    initCanvas(canvas);
    if (loading) loading.style.display = 'none';
    if (wrapper) wrapper.style.display = '';
    if (toolbarTools) toolbarTools.classList.remove('noxspot-toolbar-tools--disabled');
    // initToolbar fired onToolChange('element') before captureReady, so the
    // picker was never actually activated. Re-trigger the currently active
    // tool now — without this the canvas stays enabled with its default
    // 'arrow' tool and the user draws arrows instead of picking elements.
    const activeBtn = toolbarTools?.querySelector('.noxspot-tool-btn.active');
    const activeTool = activeBtn?.dataset?.tool;
    if (activeTool) handleToolChange(activeTool);
    debugLog('[NoxSpot] Capture hydrated');
  };

  img.addEventListener('load', finishHydrate, { once: true });
  // Without an error listener, a failed image load (CSP blocking data: URLs,
  // invalid/empty dataUrl, tainted canvas) leaves the spinner on-screen forever.
  img.addEventListener('error', () => {
    debugLog('[NoxSpot] Screenshot image failed to load — continuing without screenshot');
    finishHydrate();
  }, { once: true });
  img.src = capture.dataUrl;
  if (img.complete && img.naturalWidth > 0) {
    finishHydrate();
    return;
  }
  // Safety net: some browsers/CSPs silently swallow both load and error for
  // data: URLs. After 8s of no signal, reveal the form anyway so the user
  // can still submit — they just won't have a screenshot preview.
  hydrateTimer = setTimeout(() => {
    if (!hydrated) {
      debugLog('[NoxSpot] Screenshot hydration timed out — revealing form anyway');
      finishHydrate();
    }
  }, 8000);
}

/**
 * Hide and remove the overlay
 */
export function hideOverlay() {
  if (!overlayElement) return;

  document.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('resize', handleResize);
  window.visualViewport?.removeEventListener('resize', syncOverlayDimensions);
  window.visualViewport?.removeEventListener('scroll', syncOverlayDimensions);
  document.body.style.overflow = '';
  restoreViewportZoom();

  // Cleanup components
  deactivateScreenshotElementPicker();
  destroyToolbar();
  destroyCanvas();

  overlayElement.remove();
  overlayElement = null;
  screenshotData = null;
  elementMapData = null;
  viewportData = null;
  metadataCache = null;
  getContextFn = null;
  selectedElements = [];
  highlightOverlay = null;
  mobileStep = 1;
  lastTouchedElement = null;
  capturePromise = null;
  captureReady = false;

  // Restore focus to the element that was focused before the overlay opened
  if (previouslyFocusedElement) {
    previouslyFocusedElement.focus();
    previouslyFocusedElement = null;
  }

  if (onCloseCallback) {
    onCloseCallback();
    onCloseCallback = null;
  }

  debugLog('[NoxSpot] Overlay closed');
}

function syncOverlayDimensions() {
  if (!overlayElement) return;
  const vv = window.visualViewport;
  // Width follows visualViewport so pinch-zoom / input-zoom on iOS keeps the
  // overlay matched to the visible area.
  const width = vv ? vv.width : window.innerWidth;
  // Height uses the layout viewport (innerHeight). visualViewport.height
  // shrinks when the mobile keyboard opens — using it would reveal the host
  // page below the overlay on step 2 as soon as a form input is focused.
  const height = window.innerHeight;
  const offsetLeft = vv ? vv.offsetLeft : 0;

  overlayElement.style.width = `${width}px`;
  overlayElement.style.height = `${height}px`;
  overlayElement.style.left = `${offsetLeft}px`;
  overlayElement.style.top = `0px`;
  overlayElement.style.setProperty('--noxspot-vw', `${width}px`);
  overlayElement.style.setProperty('--noxspot-vh', `${height}px`);
}

function lockViewportZoom() {
  const locked = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
  let meta = document.querySelector('meta[name="viewport"]');
  if (meta) {
    originalViewportMeta = meta.getAttribute('content');
    meta.setAttribute('content', locked);
    viewportMetaAdded = false;
  } else {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'viewport');
    meta.setAttribute('content', locked);
    document.head.appendChild(meta);
    originalViewportMeta = null;
    viewportMetaAdded = true;
  }
}

function restoreViewportZoom() {
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  if (viewportMetaAdded) {
    meta.remove();
  } else if (originalViewportMeta !== null) {
    meta.setAttribute('content', originalViewportMeta);
  }
  originalViewportMeta = null;
  viewportMetaAdded = false;
}

function handleKeyDown(e) {
  if (e.key === 'Escape') {
    hideOverlay();
    return;
  }

  // Focus trap: keep Tab within the overlay
  if (e.key === 'Tab' && overlayElement) {
    const focusable = Array.from(overlayElement.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )).filter(el => el.getClientRects().length > 0);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
}

function handleToolChange(tool) {
  // Annotation tools depend on the rendered screenshot — no-op until capture is ready.
  if (!captureReady) return;
  if (tool === 'element') {
    // Activate element picker mode on screenshot
    activateScreenshotElementPicker();
  } else {
    // Deactivate if switching away from element tool
    deactivateScreenshotElementPicker();
  }
}

/**
 * Mobile two-step flow: toggle between annotate (1) and describe (2)
 */
function setMobileStep(step) {
  if (!overlayElement) return;
  mobileStep = step;

  const toolbar = overlayElement.querySelector('.noxspot-toolbar');
  const canvasArea = overlayElement.querySelector('.noxspot-canvas-area');
  const sidebar = overlayElement.querySelector('.noxspot-sidebar');
  const nextBtn = overlayElement.querySelector('.noxspot-mobile-next');

  if (step === 1) {
    // Show annotate view
    if (toolbar) toolbar.style.display = '';
    if (canvasArea) canvasArea.style.display = '';
    if (sidebar) sidebar.classList.remove('noxspot-sidebar-visible');
    if (nextBtn) nextBtn.style.display = '';
    // Hide thumbnail when going back
    const thumb = overlayElement.querySelector('.noxspot-mobile-thumbnail');
    if (thumb) thumb.style.display = 'none';
  } else {
    // Show describe view
    if (toolbar) toolbar.style.display = 'none';
    if (canvasArea) canvasArea.style.display = 'none';
    if (sidebar) sidebar.classList.add('noxspot-sidebar-visible');
    if (nextBtn) nextBtn.style.display = 'none';
    // Show thumbnail on mobile
    const thumb = overlayElement.querySelector('.noxspot-mobile-thumbnail');
    if (thumb) thumb.style.display = '';
  }
}

/**
 * Handle resize / orientation changes
 */
function handleResize() {
  if (!overlayElement) return;
  const isMobile = window.matchMedia('(max-width: 767px)').matches;
  const wasMobile = overlayElement.classList.contains('noxspot-mobile');

  if (isMobile && !wasMobile) {
    // Switched to mobile
    overlayElement.classList.add('noxspot-mobile');
    // Add next button if missing
    if (!overlayElement.querySelector('.noxspot-mobile-next')) {
      const nextBtn = document.createElement('button');
      nextBtn.className = 'noxspot-mobile-next';
      nextBtn.textContent = 'Continue';
      nextBtn.addEventListener('click', () => setMobileStep(2));
      overlayElement.querySelector('.noxspot-overlay-content').appendChild(nextBtn);
    }
    if (!overlayElement.querySelector('.noxspot-mobile-close')) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'noxspot-mobile-close';
      closeBtn.setAttribute('aria-label', 'Close');
      closeBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      `;
      closeBtn.addEventListener('click', hideOverlay);
      overlayElement.querySelector('.noxspot-overlay-content').appendChild(closeBtn);
    }
    setMobileStep(1);
  } else if (!isMobile && wasMobile) {
    // Switched to desktop
    overlayElement.classList.remove('noxspot-mobile');
    // Show everything, remove mobile UI
    const toolbar = overlayElement.querySelector('.noxspot-toolbar');
    const canvasArea = overlayElement.querySelector('.noxspot-canvas-area');
    const sidebar = overlayElement.querySelector('.noxspot-sidebar');
    const nextBtn = overlayElement.querySelector('.noxspot-mobile-next');
    const mobileClose = overlayElement.querySelector('.noxspot-mobile-close');
    if (toolbar) toolbar.style.display = '';
    if (canvasArea) canvasArea.style.display = '';
    if (sidebar) sidebar.classList.remove('noxspot-sidebar-visible');
    if (nextBtn) nextBtn.remove();
    if (mobileClose) mobileClose.remove();
    const thumb = overlayElement.querySelector('.noxspot-mobile-thumbnail');
    if (thumb) thumb.style.display = 'none';
  }
}

function activateScreenshotElementPicker() {
  elementPickerActive = true;
  disableCanvas(); // Prevent drawing while selecting elements

  const wrapper = overlayElement.querySelector('.noxspot-canvas-wrapper');
  const img = overlayElement.querySelector('.noxspot-screenshot');
  highlightOverlay = overlayElement.querySelector('.noxspot-element-highlight-overlay');

  // Style the highlight overlay to exactly match the image
  // Use offsetWidth/offsetHeight to get the displayed size
  const updateOverlaySize = () => {
    highlightOverlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: ${img.offsetWidth}px;
      height: ${img.offsetHeight}px;
      pointer-events: none;
      z-index: 10;
    `;
  };

  // Update size initially and on image load
  if (img.complete) {
    updateOverlaySize();
  }
  pickerImageLoadHandler = updateOverlaySize;
  img.addEventListener('load', pickerImageLoadHandler);

  // Add cursor style to wrapper
  wrapper.style.cursor = 'crosshair';

  // Add event listeners to wrapper
  wrapper.addEventListener('mousemove', handleScreenshotMouseMove);
  wrapper.addEventListener('click', handleScreenshotClick);

  // Touch support for mobile
  wrapper.addEventListener('touchstart', handleScreenshotTouchStart, { passive: false });
  wrapper.addEventListener('touchmove', handleScreenshotTouchMove, { passive: false });
  wrapper.addEventListener('touchend', handleScreenshotTouchEnd);

  // Show instruction
  showPickerInstruction();

  debugLog('[NoxSpot] Screenshot element picker activated');
}

function deactivateScreenshotElementPicker() {
  if (!elementPickerActive) return;
  elementPickerActive = false;
  enableCanvas(); // Re-enable drawing when leaving element picker

  const wrapper = overlayElement?.querySelector('.noxspot-canvas-wrapper');
  if (wrapper) {
    wrapper.style.cursor = '';
    wrapper.removeEventListener('mousemove', handleScreenshotMouseMove);
    wrapper.removeEventListener('click', handleScreenshotClick);
    wrapper.removeEventListener('touchstart', handleScreenshotTouchStart);
    wrapper.removeEventListener('touchmove', handleScreenshotTouchMove);
    wrapper.removeEventListener('touchend', handleScreenshotTouchEnd);
  }
  if (pickerImageLoadHandler) {
    const img = overlayElement?.querySelector('.noxspot-screenshot');
    if (img) img.removeEventListener('load', pickerImageLoadHandler);
    pickerImageLoadHandler = null;
  }
  lastTouchedElement = null;

  if (highlightOverlay) {
    highlightOverlay.innerHTML = '';
  }

  hidePickerInstruction();
  debugLog('[NoxSpot] Screenshot element picker deactivated');
}

function handleScreenshotMouseMove(e) {
  if (!elementPickerActive || !elementMapData) return;

  const img = overlayElement.querySelector('.noxspot-screenshot');
  const imgRect = img.getBoundingClientRect();

  // Check if mouse is over the image
  if (e.clientX < imgRect.left || e.clientX > imgRect.right ||
      e.clientY < imgRect.top || e.clientY > imgRect.bottom) {
    highlightOverlay.innerHTML = '';
    highlightOverlay.dataset.currentElement = '';
    return;
  }

  // Calculate scale from viewport coordinates to displayed image coordinates
  const scaleX = imgRect.width / viewportData.width;
  const scaleY = imgRect.height / viewportData.height;

  // Map mouse position to original viewport coordinates
  const x = (e.clientX - imgRect.left) / scaleX;
  const y = (e.clientY - imgRect.top) / scaleY;

  // Find element at this position (elementMap is sorted by area, smallest first)
  const element = elementMapData.find(el =>
    x >= el.rect.left && x <= el.rect.right &&
    y >= el.rect.top && y <= el.rect.bottom
  );

  if (element) {
    // Convert element coordinates to displayed pixels
    const displayLeft = element.rect.left * scaleX;
    const displayTop = element.rect.top * scaleY;
    const displayWidth = element.rect.width * scaleX;
    const displayHeight = element.rect.height * scaleY;

    // Build label with more context
    let label = element.tagName;
    if (element.id) label += `#${element.id}`;
    else if (element.classes.length) label += `.${element.classes[0]}`;
    if (element.text && element.text.length > 0) {
      label += ` "${element.text.substring(0, 30)}${element.text.length > 30 ? '...' : ''}"`;
    }

    // Calculate label position - above the highlight box
    const labelTop = Math.max(0, displayTop - 28);

    highlightOverlay.innerHTML = `
      <div style="
        position: absolute;
        left: ${displayLeft}px;
        top: ${displayTop}px;
        width: ${displayWidth}px;
        height: ${displayHeight}px;
        border: 3px solid #9B78F4;
        background: rgba(155, 120, 244, 0.15);
        border-radius: 4px;
        pointer-events: none;
        box-sizing: border-box;
      "></div>
      <div style="
        position: absolute;
        left: ${displayLeft}px;
        top: ${labelTop}px;
        background: #201E1D;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 12px;
        pointer-events: none;
        white-space: nowrap;
        max-width: 300px;
        overflow: hidden;
        text-overflow: ellipsis;
      ">${escapeHtml(label)}</div>
    `;

    highlightOverlay.dataset.currentElement = JSON.stringify(element);
  } else {
    highlightOverlay.innerHTML = '';
    highlightOverlay.dataset.currentElement = '';
  }
}

function handleScreenshotClick(e) {
  if (!elementPickerActive || !highlightOverlay.dataset.currentElement) return;

  const element = JSON.parse(highlightOverlay.dataset.currentElement);
  // Pass all element data for AI debugging context
  handleElementSelected({
    selector: element.selector,
    fullSelector: element.fullSelector,
    tagName: element.tagName,
    id: element.id,
    classes: element.classes,
    text: element.text,
    dataAttributes: element.dataAttributes,
    ancestorData: element.ancestorData,
    accessibleName: element.accessibleName,
    context: element.context,
    rect: element.rect,
    html: element.html,
  });
}

let touchMoved = false;

function handleScreenshotTouchStart(e) {
  if (!elementPickerActive || !elementMapData) return;
  e.preventDefault();
  touchMoved = false;

  const touch = e.touches[0];
  const img = overlayElement.querySelector('.noxspot-screenshot');
  const imgRect = img.getBoundingClientRect();

  const scaleX = imgRect.width / viewportData.width;
  const scaleY = imgRect.height / viewportData.height;

  const x = (touch.clientX - imgRect.left) / scaleX;
  const y = (touch.clientY - imgRect.top) / scaleY;

  const element = elementMapData.find(el =>
    x >= el.rect.left && x <= el.rect.right &&
    y >= el.rect.top && y <= el.rect.bottom
  );

  if (element) {
    // Show highlight
    const displayLeft = element.rect.left * scaleX;
    const displayTop = element.rect.top * scaleY;
    const displayWidth = element.rect.width * scaleX;
    const displayHeight = element.rect.height * scaleY;

    let label = element.tagName;
    if (element.id) label += `#${element.id}`;
    else if (element.classes.length) label += `.${element.classes[0]}`;
    if (element.text && element.text.length > 0) {
      label += ` "${element.text.substring(0, 30)}${element.text.length > 30 ? '...' : ''}"`;
    }
    const safeLabel = escapeHtml(label);

    const labelTop = Math.max(0, displayTop - 28);

    highlightOverlay.innerHTML = `
      <div style="
        position: absolute;
        left: ${displayLeft}px;
        top: ${displayTop}px;
        width: ${displayWidth}px;
        height: ${displayHeight}px;
        border: 3px solid #9B78F4;
        background: rgba(155, 120, 244, 0.15);
        border-radius: 4px;
        pointer-events: none;
        box-sizing: border-box;
      "></div>
      <div style="
        position: absolute;
        left: ${displayLeft}px;
        top: ${labelTop}px;
        background: #201E1D;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 12px;
        pointer-events: none;
        white-space: nowrap;
        max-width: 300px;
        overflow: hidden;
        text-overflow: ellipsis;
      ">${safeLabel}</div>
    `;

    highlightOverlay.dataset.currentElement = JSON.stringify(element);
  }
}

function handleScreenshotTouchMove(e) {
  touchMoved = true;
}

function handleScreenshotTouchEnd(e) {
  e.preventDefault();
  if (touchMoved) return; // Ignore if user scrolled
  if (!elementPickerActive || !highlightOverlay?.dataset.currentElement) return;

  const currentEl = highlightOverlay.dataset.currentElement;

  if (lastTouchedElement === currentEl) {
    // Second tap on same element → select it
    const element = JSON.parse(currentEl);
    handleElementSelected({
      selector: element.selector,
      fullSelector: element.fullSelector,
      tagName: element.tagName,
      id: element.id,
      classes: element.classes,
      text: element.text,
      dataAttributes: element.dataAttributes,
      ancestorData: element.ancestorData,
      accessibleName: element.accessibleName,
      context: element.context,
      rect: element.rect,
      html: element.html,
    });
    lastTouchedElement = null;
  } else {
    // First tap → highlight only
    lastTouchedElement = currentEl;
  }
}

let pickerInstructionEl = null;

function showPickerInstruction() {
  const isMobile = window.matchMedia('(max-width: 767px)').matches;
  pickerInstructionEl = document.createElement('div');
  pickerInstructionEl.className = 'noxspot-picker-instruction';
  pickerInstructionEl.style.cssText = `
    position: fixed;
    top: 70px;
    left: 50%;
    transform: translateX(-50%);
    background: #201E1D;
    color: white;
    padding: 10px 20px;
    border-radius: 6px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    z-index: 2147483647;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `;
  pickerInstructionEl.textContent = isMobile
    ? 'Tap to highlight, tap again to select'
    : 'Click on an element to select it';
  document.body.appendChild(pickerInstructionEl);
}

function hidePickerInstruction() {
  if (pickerInstructionEl) {
    pickerInstructionEl.remove();
    pickerInstructionEl = null;
  }
}

function handleElementSelected(elementInfo) {
  // Check if element is already selected (by fullSelector which is unique)
  const exists = selectedElements.some(el => el.fullSelector === elementInfo.fullSelector);
  if (!exists) {
    selectedElements.push(elementInfo);
    updateSelectedElements(selectedElements, handleRemoveElement);
    drawSelectedElementHighlights();
    debugLog('[NoxSpot] Element added:', elementInfo.fullSelector);
  } else {
    debugLog('[NoxSpot] Element already selected:', elementInfo.fullSelector);
  }
}

function handleRemoveElement(index) {
  selectedElements.splice(index, 1);
  updateSelectedElements(selectedElements, handleRemoveElement);
  drawSelectedElementHighlights();
  debugLog('[NoxSpot] Element removed, remaining:', selectedElements.length);
}

/**
 * Draw permanent highlight boxes for all selected elements
 */
function drawSelectedElementHighlights() {
  const container = overlayElement?.querySelector('.noxspot-selected-highlights');
  if (!container) return;

  const img = overlayElement.querySelector('.noxspot-screenshot');
  if (!img) return;

  const imgRect = img.getBoundingClientRect();
  const scaleX = imgRect.width / viewportData.width;
  const scaleY = imgRect.height / viewportData.height;

  let html = '';
  for (const el of selectedElements) {
    if (!el.rect) continue;

    const displayLeft = el.rect.left * scaleX;
    const displayTop = el.rect.top * scaleY;
    const displayWidth = el.rect.width * scaleX;
    const displayHeight = el.rect.height * scaleY;

    html += `
      <div style="
        position: absolute;
        left: ${displayLeft}px;
        top: ${displayTop}px;
        width: ${displayWidth}px;
        height: ${displayHeight}px;
        border: 3px solid #9B78F4;
        background: rgba(155, 120, 244, 0.15);
        border-radius: 4px;
        pointer-events: none;
        box-sizing: border-box;
      "></div>
    `;
  }

  container.innerHTML = html;
}

async function handleFormSubmit(formData) {
  await submitWith(formData, onSubmitCallback);
}

async function submitWith(formData, callback) {
  if (!callback) return;

  // If the user submits before the screenshot capture resolves, wait for it
  // so the final composite (screenshot + annotations) actually contains an image.
  if (!captureReady && capturePromise) {
    try {
      await capturePromise;
    } catch {
      // Capture error already triggered hideOverlay via the catch handler.
      return;
    }
    if (!overlayElement) return;
  }

  // Capture exactly what's visible in the canvas area
  const finalScreenshot = await captureCanvasArea();

  // Build context from metadata, elements, and custom callback
  const context = buildContext();

  callback({
    ...formData,
    screenshot: finalScreenshot,
    metadata: metadataCache,
    elements: selectedElements,
    context,
  });
}

/**
 * Build context data from URL entities, element data attrs, and custom callback
 */
function buildContext() {
  const result = { urlEntities: {}, ancestorContext: {}, customContext: {} };

  // URL entities from metadata
  if (metadataCache?.urlEntities) {
    Object.assign(result.urlEntities, metadataCache.urlEntities);
  }

  // Ancestor + own data attrs from selected elements
  for (const el of selectedElements) {
    if (el.dataAttributes) {
      for (const [attr, value] of Object.entries(el.dataAttributes)) {
        const key = attr.replace(/^data-/, '');
        if (!(key in result.ancestorContext)) result.ancestorContext[key] = value;
      }
    }
    if (el.ancestorData) {
      for (const [attr, value] of Object.entries(el.ancestorData)) {
        const key = attr.replace(/^data-/, '');
        if (!(key in result.ancestorContext)) result.ancestorContext[key] = value;
      }
    }
  }

  // Custom context callback
  if (getContextFn) {
    try {
      const custom = getContextFn();
      if (custom && typeof custom === 'object') {
        for (const [key, value] of Object.entries(custom)) {
          result.customContext[key] = String(value);
        }
      }
    } catch (e) {
      console.warn('[NoxSpot] getContext() threw an error:', e);
    }
  }

  return result;
}

/**
 * Composite the screenshot + selected-element highlights + drawing canvas
 * into a single PNG. All three layers are canvases or images already, so we
 * just stack them manually — no DOM rasterization needed here.
 */
function captureCanvasArea() {
  const img = overlayElement.querySelector('.noxspot-screenshot');
  const drawingCanvas = overlayElement.querySelector('.noxspot-drawing-canvas');

  const mergeCanvas = document.createElement('canvas');
  mergeCanvas.width = img.naturalWidth;
  mergeCanvas.height = img.naturalHeight;
  const ctx = mergeCanvas.getContext('2d');

  // Draw screenshot
  ctx.drawImage(img, 0, 0);

  // Draw selected element highlights
  if (selectedElements.length > 0) {
    // el.rect is in logical (CSS) viewport coords; the merge canvas is at the
    // screenshot's image-pixel size (viewport × devicePixelRatio). Without
    // scaling, every highlight ends up in the top-left quadrant on Retina.
    const scaleX = viewportData?.width ? mergeCanvas.width / viewportData.width : 1;
    const scaleY = viewportData?.height ? mergeCanvas.height / viewportData.height : 1;

    ctx.strokeStyle = '#9B78F4';
    ctx.lineWidth = 4 * scaleX;
    ctx.fillStyle = 'rgba(155, 120, 244, 0.15)';

    for (const el of selectedElements) {
      if (!el.rect) continue;
      const x = el.rect.left * scaleX;
      const y = el.rect.top * scaleY;
      const w = el.rect.width * scaleX;
      const h = el.rect.height * scaleY;
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
    }
  }

  // Draw annotations
  if (hasAnnotations()) {
    ctx.drawImage(drawingCanvas, 0, 0);
  }

  // JPEG keeps the submitted payload under the API's 7MB base64 limit even
  // on 2x DPR / large viewports. The screenshot is photographic UI content,
  // not pixel-perfect line art — quality 0.85 is visually indistinguishable.
  return mergeCanvas.toDataURL('image/jpeg', 0.85);
}

/**
 * Get the current screenshot data
 */
export function getScreenshotData() {
  return screenshotData;
}

/**
 * Get the current metadata
 */
export function getMetadata() {
  return metadataCache;
}
