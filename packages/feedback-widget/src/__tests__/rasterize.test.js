import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureViewport } from '../rasterize.js';

const originalImage = globalThis.Image;
const originalRect = Element.prototype.getBoundingClientRect;
const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;

afterEach(() => {
  globalThis.Image = originalImage;
  Element.prototype.getBoundingClientRect = originalRect;
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  HTMLCanvasElement.prototype.toDataURL = originalToDataURL;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('viewport-bounded rasterization', () => {
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
});
