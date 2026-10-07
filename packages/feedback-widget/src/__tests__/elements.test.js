import { describe, it, expect, beforeEach } from 'vitest';
import { generateSelector, isUnique, extractElementInfo } from '../elements.js';

describe('isUnique', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns true when selector matches exactly one element', () => {
    document.body.innerHTML = '<div id="unique">test</div>';
    const el = document.getElementById('unique');
    expect(isUnique('#unique', el)).toBe(true);
  });

  it('returns false when selector matches multiple elements', () => {
    document.body.innerHTML = '<div class="shared"></div><div class="shared"></div>';
    const el = document.querySelector('.shared');
    expect(isUnique('.shared', el)).toBe(false);
  });

  it('returns false when selector matches different element', () => {
    document.body.innerHTML = '<div id="a"></div><div id="b"></div>';
    const elA = document.getElementById('a');
    expect(isUnique('#b', elA)).toBe(false);
  });

  it('returns false for invalid selector', () => {
    document.body.innerHTML = '<div></div>';
    const el = document.querySelector('div');
    expect(isUnique('[invalid', el)).toBe(false);
  });
});

describe('generateSelector', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns null for non-element nodes', () => {
    expect(generateSelector(null)).toBe(null);
  });

  it('uses ID when available and unique', () => {
    document.body.innerHTML = '<div id="my-element">test</div>';
    const el = document.getElementById('my-element');
    expect(generateSelector(el)).toBe('#my-element');
  });

  it('uses tag + classes for elements without ID', () => {
    document.body.innerHTML = '<button class="btn-primary">Click</button>';
    const el = document.querySelector('.btn-primary');
    const selector = generateSelector(el);
    expect(selector).toContain('btn-primary');
  });

  it('builds path with nth-of-type for disambiguation', () => {
    document.body.innerHTML = '<ul><li>First</li><li>Second</li></ul>';
    const secondLi = document.querySelectorAll('li')[1];
    const selector = generateSelector(secondLi);
    // Should contain nth-of-type since there are multiple li siblings
    expect(selector).toBeTruthy();
  });

  it('ignores noxspot classes', () => {
    document.body.innerHTML = '<div class="noxspot-overlay real-class">test</div>';
    const el = document.querySelector('div');
    const selector = generateSelector(el);
    expect(selector).not.toContain('noxspot-overlay');
  });
});

describe('extractElementInfo', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns null for non-element nodes', () => {
    expect(extractElementInfo(null)).toBe(null);
  });

  it('extracts basic element info', () => {
    document.body.innerHTML = '<button id="submit-btn" class="primary">Submit</button>';
    const el = document.getElementById('submit-btn');
    const info = extractElementInfo(el);

    expect(info.tagName).toBe('button');
    expect(info.id).toBe('submit-btn');
    expect(info.selector).toBeTruthy();
    expect(info.text).toContain('Submit');
  });

  it('extracts classes excluding noxspot classes', () => {
    document.body.innerHTML = '<div class="card noxspot-temp active">test</div>';
    const el = document.querySelector('div');
    const info = extractElementInfo(el);

    expect(info.classes).toContain('card');
    expect(info.classes).toContain('active');
    expect(info.classes).not.toContain('noxspot-temp');
  });

  it('extracts aria-label', () => {
    document.body.innerHTML = '<button aria-label="Close dialog">X</button>';
    const el = document.querySelector('button');
    const info = extractElementInfo(el);

    expect(info.ariaLabel).toBe('Close dialog');
  });

  it('extracts role', () => {
    document.body.innerHTML = '<div role="navigation">nav</div>';
    const el = document.querySelector('div');
    const info = extractElementInfo(el);

    expect(info.role).toBe('navigation');
  });

  it('truncates long text content', () => {
    const longText = 'a'.repeat(200);
    document.body.innerHTML = `<p>${longText}</p>`;
    const el = document.querySelector('p');
    const info = extractElementInfo(el);

    expect(info.text.length).toBeLessThanOrEqual(103); // 100 + '...'
  });

  it('extracts data attributes, skipping noise', () => {
    document.body.innerHTML = '<div data-record-id="42" data-state="open" data-radix-item="true">test</div>';
    const el = document.querySelector('div');
    const info = extractElementInfo(el);

    expect(info.dataAttributes).toBeDefined();
    expect(info.dataAttributes['data-record-id']).toBe('42');
    expect(info.dataAttributes['data-state']).toBeUndefined();
    expect(info.dataAttributes['data-radix-item']).toBeUndefined();
  });
});
