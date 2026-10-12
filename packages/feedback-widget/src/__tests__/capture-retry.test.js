import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../rasterize.js', () => ({
  captureViewport: vi.fn(),
}));

import { captureViewport } from '../rasterize.js';
import { captureScreenshot } from '../capture.js';

describe('capture consistency', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('retries once when the host application renders during capture', async () => {
    captureViewport
      .mockImplementationOnce(async () => {
        const renderedContent = document.createElement('main');
        renderedContent.textContent = 'Application content';
        document.body.appendChild(renderedContent);
        return { dataUrl: 'data:image/png;base64,shell', viewport: { width: 100, height: 100 } };
      })
      .mockResolvedValueOnce({
        dataUrl: 'data:image/png;base64,complete',
        viewport: { width: 100, height: 100 },
      });

    const result = await captureScreenshot({ includeElementMap: false });

    expect(captureViewport).toHaveBeenCalledTimes(2);
    expect(result.dataUrl).toBe('data:image/png;base64,complete');
  });
});
