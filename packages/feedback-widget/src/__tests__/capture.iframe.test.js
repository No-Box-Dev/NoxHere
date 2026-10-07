import { describe, it, expect, beforeEach } from 'vitest';
import { captureElementMap } from '../capture.js';

describe('captureElementMap iframe descent', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('walks into same-origin iframe contentDocument and includes inner elements', async () => {
    document.body.innerHTML = `
      <button id="outer-btn" style="width:100px;height:30px;display:block">Outer</button>
      <iframe id="frame" style="width:600px;height:300px;display:block"></iframe>
    `;
    const iframe = document.getElementById('frame');
    // jsdom requires writing into contentDocument directly to populate.
    iframe.contentDocument.body.innerHTML = `
      <button id="inner-btn" data-foo="bar" style="width:120px;height:40px;display:block">Inside iframe</button>
    `;

    // jsdom returns 0×0 for getBoundingClientRect — patch the methods our walker
    // depends on so the visibility filter doesn't drop everything.
    const stubRect = (el, rect) => {
      el.getBoundingClientRect = () => ({ ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height });
    };
    stubRect(document.getElementById('outer-btn'), { left: 0, top: 0, width: 100, height: 30 });
    stubRect(iframe, { left: 0, top: 50, width: 600, height: 300 });
    stubRect(iframe.contentDocument.body, { left: 0, top: 0, width: 600, height: 300 });
    stubRect(iframe.contentDocument.getElementById('inner-btn'), { left: 10, top: 10, width: 120, height: 40 });

    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });

    const elements = captureElementMap();
    const ids = elements.map(e => e.id).filter(Boolean);
    expect(ids).toContain('outer-btn');
    expect(ids).toContain('inner-btn');

    const inner = elements.find(e => e.id === 'inner-btn');
    expect(inner).toBeDefined();
    // Translated to top-page coords: iframe at top=50 + inner at top=10 = 60
    expect(inner.rect.top).toBe(60);
    expect(inner.rect.left).toBe(10);
    expect(inner.framePath).toMatch(/iframe\[/);
    expect(inner.dataAttributes['data-foo']).toBe('bar');
  });

  it('skips iframe whose contentDocument is null (cross-origin) without descending', () => {
    document.body.innerHTML = `<iframe id="x" style="width:600px;height:300px"></iframe>`;
    const iframe = document.getElementById('x');
    // Modern browsers return null for contentDocument on cross-origin frames.
    // (jsdom still populates one — override so we exercise the null branch.)
    Object.defineProperty(iframe, 'contentDocument', { get: () => null, configurable: true });
    iframe.getBoundingClientRect = () => ({ left: 0, top: 0, right: 600, bottom: 300, width: 600, height: 300 });
    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });

    let elements;
    expect(() => { elements = captureElementMap(); }).not.toThrow();
    // The iframe wrapper itself is still picked up; just nothing inside it.
    expect(elements.find(e => e.id === 'x')).toBeDefined();
  });
});
