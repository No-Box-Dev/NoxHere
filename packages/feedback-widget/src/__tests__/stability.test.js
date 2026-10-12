import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitForHostDomStable } from '../stability.js';

describe('waitForHostDomStable', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<main>shell</main>';
    vi.stubGlobal('requestAnimationFrame', (callback) => setTimeout(callback, 0));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('does not accept an initially quiet shell before the minimum wait', async () => {
    let resolved = false;
    const stable = waitForHostDomStable({ minWaitMs: 700, quietMs: 250, maxWaitMs: 2_000 })
      .then(() => { resolved = true; });

    await vi.advanceTimersByTimeAsync(699);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(10);
    await stable;
    expect(resolved).toBe(true);
  });

  it('waits for follow-up framework mutations to become quiet', async () => {
    let resolved = false;
    const stable = waitForHostDomStable({ minWaitMs: 700, quietMs: 250, maxWaitMs: 2_000 })
      .then(() => { resolved = true; });

    await vi.advanceTimersByTimeAsync(600);
    document.querySelector('main').append(document.createElement('section'));
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(249);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(10);
    await stable;
    expect(resolved).toBe(true);
  });

  it('waits for a host loading state to be replaced', async () => {
    document.body.innerHTML = '<main role="status" aria-label="Loading content"><div class="skeleton-card"></div></main>';
    let resolved = false;
    const stable = waitForHostDomStable({ minWaitMs: 100, quietMs: 100, maxWaitMs: 1_000 })
      .then(() => { resolved = true; });

    await vi.advanceTimersByTimeAsync(500);
    expect(resolved).toBe(false);
    document.querySelector('main').replaceWith(document.createElement('main'));
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(110);
    await stable;
    expect(resolved).toBe(true);
  });

  it('uses the hard deadline for continuously changing pages', async () => {
    let resolved = false;
    const stable = waitForHostDomStable({ minWaitMs: 100, quietMs: 100, maxWaitMs: 500 })
      .then(() => { resolved = true; });

    for (let elapsed = 0; elapsed < 500; elapsed += 50) {
      document.body.dataset.tick = String(elapsed);
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(50);
    }
    await vi.advanceTimersByTimeAsync(10);
    await stable;
    expect(resolved).toBe(true);
  });
});
