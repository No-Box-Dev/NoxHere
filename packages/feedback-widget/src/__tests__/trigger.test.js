import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { darkenColor, createTrigger, updateTrigger, getTrigger, destroyTrigger } from '../trigger.js';

describe('updateTrigger', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    destroyTrigger();
  });

  it('updates the button background color', () => {
    createTrigger(() => {}, { color: '#FE795D', text: 'Report issue' });
    updateTrigger({ color: '#123456' });
    const btn = getTrigger();
    expect(btn.style.background).toBeTruthy();
    expect(btn.dataset.color).toBe('#123456');
  });

  it('updates the button text and aria-label', () => {
    createTrigger(() => {}, { color: '#FE795D', text: 'Report issue' });
    updateTrigger({ text: 'Send feedback' });
    const btn = getTrigger();
    expect(btn.querySelector('.noxspot-trigger-text').textContent).toBe('Send feedback');
    expect(btn.getAttribute('aria-label')).toBe('Send feedback');
  });

  it('no-ops when the button does not exist', () => {
    expect(() => updateTrigger({ color: '#000' })).not.toThrow();
  });
});

describe('darkenColor', () => {
  it('darkens a hex color by percentage', () => {
    // #FE795D darkened by 20% -> each channel * 0.8
    // R: 254 * 0.8 = 203.2 -> 203 -> cb
    // G: 121 * 0.8 = 96.8 -> 96 -> 60
    // B: 93 * 0.8 = 74.4 -> 74 -> 4a
    expect(darkenColor('#FE795D', 20)).toBe('#cb604a');
  });

  it('handles color without hash prefix', () => {
    expect(darkenColor('FE795D', 20)).toBe('#cb604a');
  });

  it('returns black when darkened by 100%', () => {
    expect(darkenColor('#FF0000', 100)).toBe('#000000');
  });

  it('returns same color when darkened by 0%', () => {
    expect(darkenColor('#FFFFFF', 0)).toBe('#ffffff');
  });

  it('clamps to 0 (no negative values)', () => {
    expect(darkenColor('#010101', 50)).toBe('#000000');
  });

  it('handles pure white', () => {
    // 255 * 0.5 = 127.5 -> 127 -> 7f
    expect(darkenColor('#FFFFFF', 50)).toBe('#7f7f7f');
  });
});
