import { describe, expect, it, vi } from 'vitest';

vi.mock('../rasterize.js', () => ({
  captureViewport: vi.fn(async () => {
    const error = new Error('Page capture exceeded the node limit');
    error.code = 'capture_limit_exceeded';
    throw error;
  }),
}));

import { captureScreenshot } from '../capture.js';

describe('capture fallback', () => {
  it('returns a submittable result when rasterization exceeds its budget', async () => {
    const trigger = document.createElement('button');
    trigger.className = 'noxspot-trigger';
    document.body.appendChild(trigger);

    const result = await captureScreenshot({ includeElementMap: false });

    expect(result).toMatchObject({
      dataUrl: null,
      elementMap: [],
      captureError: {
        code: 'capture_limit_exceeded',
        message: 'Page capture exceeded the node limit',
      },
    });
    expect(trigger.style.visibility).toBe('visible');
    trigger.remove();
  });
});
