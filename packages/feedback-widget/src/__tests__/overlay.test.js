import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Stub canvas + toolbar so they don't touch imaging APIs jsdom can't handle
vi.mock('../canvas.js', () => ({
  initCanvas: vi.fn(),
  destroyCanvas: vi.fn(),
  disableCanvas: vi.fn(),
  enableCanvas: vi.fn(),
  hasAnnotations: vi.fn(() => false),
  getCanvasDataURL: vi.fn(() => ''),
}));
vi.mock('../toolbar.js', () => ({
  createToolbarHTML: () => '<button class="feedback-tool-btn active" data-tool="element">Select element</button>',
  initToolbar: vi.fn(),
  destroyToolbar: vi.fn(),
}));
vi.mock('../metadata.js', () => ({
  collectMetadata: () => ({
    url: 'https://example.com',
    browser: 'Chrome',
    os: 'macOS',
    viewport: '1024x768',
    timestamp: '2026-04-19T00:00:00Z',
    consoleErrors: [],
  }),
}));

import { showOverlay, hideOverlay } from '../overlay.js';
import { initToolbar } from '../toolbar.js';

beforeEach(() => {
  document.body.innerHTML = '';
  vi.mocked(initToolbar).mockReset();
  if (!window.matchMedia) {
    window.matchMedia = vi.fn(() => ({ matches: false }));
  }
});

afterEach(() => {
  hideOverlay();
});

describe('showOverlay — optimistic flow', () => {
  it('renders the overlay synchronously with a loading state before capture resolves', () => {
    let resolveCapture;
    const promise = new Promise((r) => { resolveCapture = r; });

    showOverlay(promise, { onClose: () => {}, onSubmit: () => {} });

    const overlay = document.querySelector('.feedback-overlay');
    expect(overlay).not.toBeNull();

    const loading = overlay.querySelector('.feedback-canvas-loading');
    expect(loading).not.toBeNull();

    const wrapper = overlay.querySelector('.feedback-canvas-wrapper');
    expect(wrapper.style.display).toBe('none');

    const toolbarTools = overlay.querySelector('.feedback-toolbar-tools');
    expect(toolbarTools.classList.contains('feedback-toolbar-tools--disabled')).toBe(true);

    const img = overlay.querySelector('.feedback-screenshot');
    expect(img.getAttribute('src')).toBeFalsy();

    // Resolve so the promise doesn't leak between tests
    resolveCapture({ dataUrl: '', elementMap: [], viewport: { width: 100, height: 100 } });
  });

  it('hydrates the canvas and enables the toolbar once the capture resolves', async () => {
    const dataUrl = 'data:image/png;base64,iVBOR';
    const capture = { dataUrl, elementMap: [], viewport: { width: 100, height: 100 } };

    showOverlay(Promise.resolve(capture), { onClose: () => {}, onSubmit: () => {} });

    // Simulate the image load event after hydrate sets img.src
    // The overlay listens for 'load' on the <img>, so wait one microtask then fire.
    await Promise.resolve();
    await Promise.resolve();

    const overlay = document.querySelector('.feedback-overlay');
    const img = overlay.querySelector('.feedback-screenshot');
    expect(img.getAttribute('src')).toBe(dataUrl);

    // jsdom won't fire 'load' automatically for a data URL — dispatch it manually
    // and verify the finish path runs.
    Object.defineProperty(img, 'naturalWidth', { value: 100, configurable: true });
    Object.defineProperty(img, 'naturalHeight', { value: 100, configurable: true });
    img.dispatchEvent(new Event('load'));

    const loading = overlay.querySelector('.feedback-canvas-loading');
    const wrapper = overlay.querySelector('.feedback-canvas-wrapper');
    const toolbarTools = overlay.querySelector('.feedback-toolbar-tools');

    expect(loading.style.display).toBe('none');
    expect(wrapper.style.display).toBe('');
    expect(toolbarTools.classList.contains('feedback-toolbar-tools--disabled')).toBe(false);
  });

  it('reveals the form even if the screenshot image fails to load', async () => {
    const dataUrl = 'data:image/png;base64,INVALID';
    const capture = { dataUrl, elementMap: [], viewport: { width: 100, height: 100 } };

    showOverlay(Promise.resolve(capture), { onClose: () => {}, onSubmit: () => {} });

    await Promise.resolve();
    await Promise.resolve();

    const overlay = document.querySelector('.feedback-overlay');
    const img = overlay.querySelector('.feedback-screenshot');

    // Simulate a load failure (CSP block, invalid data URL, etc.)
    img.dispatchEvent(new Event('error'));

    const loading = overlay.querySelector('.feedback-canvas-loading');
    const wrapper = overlay.querySelector('.feedback-canvas-wrapper');
    const toolbarTools = overlay.querySelector('.feedback-toolbar-tools');

    expect(loading.style.display).toBe('none');
    expect(wrapper.style.display).toBe('');
    expect(toolbarTools.classList.contains('feedback-toolbar-tools--disabled')).toBe(false);
  });

  it('keeps the feedback form open when capture degrades without a screenshot', async () => {
    const onCaptureError = vi.fn();
    const capture = {
      dataUrl: null,
      elementMap: [],
      viewport: { width: 100, height: 100 },
      captureError: { code: 'capture_limit_exceeded', message: 'Page capture exceeded the node limit' },
    };

    showOverlay(Promise.resolve(capture), {
      onClose: () => {},
      onSubmit: () => {},
      onCaptureError,
    });

    await Promise.resolve();
    await Promise.resolve();

    const overlay = document.querySelector('.feedback-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay.querySelector('.feedback-canvas-loading').textContent).toContain('You can still send your feedback');
    expect(overlay.querySelector('.feedback-toolbar-tools').style.display).toBe('none');
    expect(onCaptureError).toHaveBeenCalledOnce();
  });

  it('closes the overlay and forwards the error if the capture rejects', async () => {
    const onCaptureError = vi.fn();
    const failure = new Error('capture failed');

    showOverlay(Promise.reject(failure), {
      onClose: () => {},
      onSubmit: () => {},
      onCaptureError,
    });

    // Let the rejection propagate through the .catch handler
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(document.querySelector('.feedback-overlay')).toBeNull();
    expect(onCaptureError).toHaveBeenCalledWith(failure);
  });

  it('does not render a picker instruction and cleans up stale ones on close', async () => {
    vi.mocked(initToolbar).mockImplementation((container, options) => {
      container.querySelector('[data-tool="element"]').addEventListener('click', () => {
        options.onToolChange('element');
      });
    });
    const capture = {
      dataUrl: 'data:image/png;base64,iVBOR',
      elementMap: [],
      viewport: { width: 100, height: 100 },
    };

    showOverlay(Promise.resolve(capture), {
      blocks: [{ id: 'element', type: 'element_picker' }],
      onClose: () => {},
      onSubmit: () => {},
    });
    await Promise.resolve();
    await Promise.resolve();

    const overlay = document.querySelector('.feedback-overlay');
    const img = overlay.querySelector('.feedback-screenshot');
    Object.defineProperty(img, 'naturalWidth', { value: 100, configurable: true });
    Object.defineProperty(img, 'naturalHeight', { value: 100, configurable: true });
    img.dispatchEvent(new Event('load'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(overlay.querySelectorAll('.feedback-picker-instruction')).toHaveLength(0);
    overlay.querySelector('[data-tool="element"]').click();
    expect(overlay.querySelectorAll('.feedback-picker-instruction')).toHaveLength(0);

    const staleInstruction = document.createElement('div');
    staleInstruction.className = 'feedback-picker-instruction';
    document.body.appendChild(staleInstruction);

    hideOverlay();
    expect(document.querySelector('.feedback-picker-instruction')).toBeNull();
  });
});
