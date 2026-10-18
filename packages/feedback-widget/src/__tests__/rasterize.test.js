import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureViewport } from '../rasterize.js';

const originalImage = globalThis.Image;
const originalFetch = globalThis.fetch;
const originalRect = Element.prototype.getBoundingClientRect;
const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;

afterEach(() => {
  globalThis.Image = originalImage;
  globalThis.fetch = originalFetch;
  Element.prototype.getBoundingClientRect = originalRect;
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  HTMLCanvasElement.prototype.toDataURL = originalToDataURL;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('viewport-bounded rasterization', () => {
  it('collapses a fully off-screen subtree into one layout placeholder', async () => {
    const section = document.createElement('section');
    section.dataset.position = 'offscreen';
    for (let index = 0; index < 500; index += 1) {
      const card = document.createElement('article');
      card.dataset.position = 'offscreen';
      card.textContent = `card ${index}`;
      section.appendChild(card);
    }
    document.body.appendChild(section);

    Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
      const top = this === document.body ? 0 : 5_000;
      const height = this === section ? 10_000 : 20;
      return { top, bottom: top + height, left: 0, right: 800, width: 800, height, x: 0, y: top, toJSON() {} };
    };
    class LoadedImage {
      set src(_value) { queueMicrotask(() => this.onload?.()); }
    }
    globalThis.Image = LoadedImage;
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      scale: vi.fn(), fillRect: vi.fn(), drawImage: vi.fn(), set fillStyle(_value) {},
    }));
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/jpeg;base64,ok');
    const styleSpy = vi.spyOn(window, 'getComputedStyle');

    await expect(captureViewport()).resolves.toMatchObject({ dataUrl: 'data:image/jpeg;base64,ok' });

    expect(styleSpy.mock.calls.length).toBeLessThan(10);
    expect(styleSpy).not.toHaveBeenCalledWith(section.firstElementChild);
  });

  it('preserves a viewport-visible descendant of an off-screen ancestor', async () => {
    const section = document.createElement('section');
    section.dataset.position = 'offscreen';
    const floating = document.createElement('button');
    floating.dataset.position = 'visible';
    floating.textContent = 'Floating action';
    section.appendChild(floating);
    document.body.appendChild(section);

    Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
      const visible = this === document.body || this.dataset.position === 'visible';
      const top = visible ? 20 : 5_000;
      return { top, bottom: top + 100, left: 20, right: 120, width: 100, height: 100, x: 20, y: top, toJSON() {} };
    };
    class LoadedImage {
      set src(_value) { queueMicrotask(() => this.onload?.()); }
    }
    globalThis.Image = LoadedImage;
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      scale: vi.fn(), fillRect: vi.fn(), drawImage: vi.fn(), set fillStyle(_value) {},
    }));
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/jpeg;base64,ok');
    const styleSpy = vi.spyOn(window, 'getComputedStyle');

    await captureViewport();

    expect(styleSpy).toHaveBeenCalledWith(floating);
  });

  it('collapses non-rendered subtrees without scanning their descendants', async () => {
    const hidden = document.createElement('section');
    hidden.style.display = 'none';
    for (let index = 0; index < 500; index += 1) {
      const card = document.createElement('article');
      card.textContent = `hidden card ${index}`;
      hidden.appendChild(card);
    }
    document.body.appendChild(hidden);

    Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
      return { top: 0, bottom: 100, left: 0, right: 800, width: 800, height: 100, x: 0, y: 0, toJSON() {} };
    };
    class LoadedImage {
      set src(_value) { queueMicrotask(() => this.onload?.()); }
    }
    globalThis.Image = LoadedImage;
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      scale: vi.fn(), fillRect: vi.fn(), drawImage: vi.fn(), set fillStyle(_value) {},
    }));
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/jpeg;base64,ok');
    const styleSpy = vi.spyOn(window, 'getComputedStyle');

    await expect(captureViewport()).resolves.toMatchObject({ dataUrl: 'data:image/jpeg;base64,ok' });

    expect(styleSpy).not.toHaveBeenCalledWith(hidden.firstElementChild);
  });

  it('does not fetch media that is outside the captured viewport', async () => {
    const visible = document.createElement('img');
    visible.src = 'https://images.example/visible.png';
    visible.dataset.position = 'visible';
    const offscreen = document.createElement('img');
    offscreen.src = 'https://images.example/offscreen.png';
    offscreen.dataset.position = 'offscreen';
    document.body.append(visible, offscreen);

    Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
      const top = this.dataset.position === 'offscreen' ? 5_000 : 20;
      return { top, bottom: top + 100, left: 20, right: 120, width: 100, height: 100, x: 20, y: top, toJSON() {} };
    };
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 404,
      blob: async () => new Blob(),
    }));
    class LoadedImage {
      set src(_value) { queueMicrotask(() => this.onload?.()); }
    }
    globalThis.Image = LoadedImage;
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      scale: vi.fn(), fillRect: vi.fn(), drawImage: vi.fn(), set fillStyle(_value) {},
    }));
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/jpeg;base64,ok');

    await captureViewport();

    expect(fetch).toHaveBeenCalledWith(
      'https://images.example/visible.png',
      expect.objectContaining({ mode: 'cors', credentials: 'omit' }),
    );
    expect(fetch).not.toHaveBeenCalledWith(
      'https://images.example/offscreen.png',
      expect.anything(),
    );
  });

  it('primes embedded image data before loading the outer SVG in Safari', async () => {
    const cover = document.createElement('img');
    cover.src = 'https://app.playnist.com/api/img/coc5at/t_cover_big_2x';
    document.body.appendChild(cover);

    Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
      return { top: 20, bottom: 120, left: 20, right: 120, width: 100, height: 100, x: 20, y: 20, toJSON() {} };
    };
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      blob: async () => new Blob(['cover'], { type: 'image/jpeg' }),
    }));
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/620.1.2 (KHTML, like Gecko) Version/26.0 Safari/620.1.2',
    );
    const assignedSources = [];
    class LoadedImage {
      set src(value) {
        assignedSources.push(value);
        queueMicrotask(() => this.onload?.());
      }
    }
    globalThis.Image = LoadedImage;
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      scale: vi.fn(), fillRect: vi.fn(), drawImage: vi.fn(), set fillStyle(_value) {},
    }));
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/jpeg;base64,ok');

    await captureViewport();

    expect(assignedSources).toHaveLength(2);
    expect(assignedSources[0]).toMatch(/^data:image\/jpeg;base64,/);
    expect(assignedSources[1]).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it('does not fetch media clipped outside an internal scroll viewport', async () => {
    const scroller = document.createElement('div');
    scroller.style.overflow = 'auto';
    const clipped = document.createElement('img');
    clipped.src = 'https://images.example/clipped.png';
    scroller.appendChild(clipped);
    document.body.appendChild(scroller);

    Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
      if (this === scroller) return { top: 0, bottom: 200, left: 0, right: 800, width: 800, height: 200, x: 0, y: 0, toJSON() {} };
      if (this === clipped) return { top: 600, bottom: 700, left: 20, right: 120, width: 100, height: 100, x: 20, y: 600, toJSON() {} };
      return { top: 0, bottom: 780, left: 0, right: 800, width: 800, height: 780, x: 0, y: 0, toJSON() {} };
    };
    globalThis.fetch = vi.fn();
    class LoadedImage {
      set src(_value) { queueMicrotask(() => this.onload?.()); }
    }
    globalThis.Image = LoadedImage;
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      scale: vi.fn(), fillRect: vi.fn(), drawImage: vi.fn(), set fillStyle(_value) {},
    }));
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/jpeg;base64,ok');

    await captureViewport();

    expect(fetch).not.toHaveBeenCalledWith('https://images.example/clipped.png', expect.anything());
  });

  it('collapses off-screen table rows before cloning and styling their cells', async () => {
    const table = document.createElement('table');
    const body = document.createElement('tbody');
    table.appendChild(body);
    for (let rowIndex = 0; rowIndex < 1_000; rowIndex += 1) {
      const row = document.createElement('tr');
      row.dataset.row = String(rowIndex);
      for (let column = 0; column < 6; column += 1) {
        const cell = document.createElement('td');
        cell.textContent = `${rowIndex}:${column}`;
        row.appendChild(cell);
      }
      body.appendChild(row);
    }
    document.body.appendChild(table);

    Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
      if (this.tagName === 'TR') {
        const row = Number(this.dataset.row);
        const top = row === 0 ? 20 : 2_000 + row * 24;
        return { top, bottom: top + 24, left: 0, right: 800, width: 800, height: 24, x: 0, y: top, toJSON() {} };
      }
      return { top: 0, bottom: 24, left: 0, right: 800, width: 800, height: 24, x: 0, y: 0, toJSON() {} };
    };

    class LoadedImage {
      set src(_value) { queueMicrotask(() => this.onload?.()); }
    }
    globalThis.Image = LoadedImage;
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      scale: vi.fn(),
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      set fillStyle(_value) {},
    }));
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/jpeg;base64,ok');
    const styleSpy = vi.spyOn(window, 'getComputedStyle');

    await expect(captureViewport()).resolves.toMatchObject({ dataUrl: 'data:image/jpeg;base64,ok' });
    expect(styleSpy.mock.calls.length).toBeLessThan(100);
  });

  it('does not serialize browser-internal and custom computed properties onto every node', async () => {
    for (let index = 0; index < 1_200; index += 1) {
      const node = document.createElement('div');
      node.textContent = `node ${index}`;
      document.body.appendChild(node);
    }

    class LoadedImage {
      set src(_value) { queueMicrotask(() => this.onload?.()); }
    }
    globalThis.Image = LoadedImage;
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      scale: vi.fn(),
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      set fillStyle(_value) {},
    }));
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/jpeg;base64,ok');

    const bloatedProperties = Array.from({ length: 1_000 }, (_, index) => `--inherited-token-${index}`);
    vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({
      length: bloatedProperties.length,
      backgroundColor: 'rgb(255, 255, 255)',
      getPropertyValue: (property) => property.startsWith('--') ? 'x'.repeat(80) : ({
        display: 'block',
        color: 'rgb(0, 0, 0)',
        width: '100px',
        height: '20px',
      }[property] || ''),
      getPropertyPriority: () => '',
    }));

    await expect(captureViewport()).resolves.toMatchObject({ dataUrl: 'data:image/jpeg;base64,ok' });
  });
});
