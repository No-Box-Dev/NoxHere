import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { showToast, dismissToast } from '../toast.js';

describe('toast', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('renders the message with a success dot', () => {
    showToast({ message: 'Report sent', variant: 'success' });
    const toast = document.querySelector('.noxspot-toast');
    expect(toast).toBeTruthy();
    expect(toast.classList.contains('noxspot-toast--success')).toBe(true);
    expect(toast.querySelector('.noxspot-toast-text').textContent).toBe('Report sent');
    expect(toast.getAttribute('role')).toBe('status');
  });

  it('uses alert role for error variant', () => {
    showToast({ message: 'Failed', variant: 'error', durationMs: 0 });
    const toast = document.querySelector('.noxspot-toast');
    expect(toast.getAttribute('role')).toBe('alert');
    expect(toast.classList.contains('noxspot-toast--error')).toBe(true);
  });

  it('auto-dismisses after duration', () => {
    showToast({ message: 'Hi', durationMs: 1000 });
    expect(document.querySelector('.noxspot-toast')).toBeTruthy();
    vi.advanceTimersByTime(1001);
    // fade-out removes after an extra 200ms
    vi.advanceTimersByTime(250);
    expect(document.querySelector('.noxspot-toast')).toBeNull();
  });

  it('replaces a previous toast when a new one is shown', () => {
    showToast({ message: 'First', durationMs: 5000 });
    showToast({ message: 'Second', durationMs: 5000 });
    const toasts = document.querySelectorAll('.noxspot-toast');
    // First toast is fading out but may still be in DOM briefly
    const visible = Array.from(toasts).find(t => t.querySelector('.noxspot-toast-text').textContent === 'Second');
    expect(visible).toBeTruthy();
  });

  it('renders a retry action button and calls onClick', () => {
    const onClick = vi.fn();
    showToast({
      message: 'Failed',
      variant: 'error',
      durationMs: 0,
      action: { label: 'Retry', onClick },
    });
    const btn = document.querySelector('.noxspot-toast-action');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toBe('Retry');
    btn.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('dismissToast is a no-op when nothing is showing', () => {
    expect(() => dismissToast()).not.toThrow();
  });
});
