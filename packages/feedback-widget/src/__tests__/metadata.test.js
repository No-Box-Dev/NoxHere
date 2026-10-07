import { describe, it, expect, beforeEach, vi } from 'vitest';
import { extractUrlEntities, getBrowser, getOS } from '../metadata.js';

describe('extractUrlEntities', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/', hostname: 'localhost', href: 'http://localhost/' },
      writable: true,
    });
  });

  it('extracts simple label/ID pairs from path', () => {
    window.location = { ...window.location, pathname: '/users/123/reports/456' };
    const result = extractUrlEntities();
    expect(result).toEqual({ users: '123', reports: '456' });
  });

  it('extracts UUID IDs', () => {
    window.location = { ...window.location, pathname: '/patients/550e8400-e29b-41d4-a716-446655440000' };
    const result = extractUrlEntities();
    expect(result).toEqual({ patients: '550e8400-e29b-41d4-a716-446655440000' });
  });

  it('extracts hex-like IDs', () => {
    window.location = { ...window.location, pathname: '/items/a1b2c3d4' };
    const result = extractUrlEntities();
    expect(result).toEqual({ items: 'a1b2c3d4' });
  });

  it('returns empty for paths with no IDs', () => {
    window.location = { ...window.location, pathname: '/about/team' };
    const result = extractUrlEntities();
    expect(result).toEqual({});
  });

  it('returns empty for root path', () => {
    window.location = { ...window.location, pathname: '/' };
    const result = extractUrlEntities();
    expect(result).toEqual({});
  });

  it('handles single segment with no ID', () => {
    window.location = { ...window.location, pathname: '/dashboard' };
    const result = extractUrlEntities();
    expect(result).toEqual({});
  });

  it('handles ID at first position (no label)', () => {
    window.location = { ...window.location, pathname: '/123' };
    const result = extractUrlEntities();
    expect(result).toEqual({}); // index 0 with no predecessor
  });
});

describe('getBrowser', () => {
  it('detects Chrome', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    expect(getBrowser()).toBe('Chrome 120');
  });

  it('detects Firefox', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0'
    );
    expect(getBrowser()).toBe('Firefox 121');
  });

  it('detects Edge', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
    );
    expect(getBrowser()).toBe('Edge 120');
  });

  it('detects Safari', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
    );
    expect(getBrowser()).toBe('Safari 17');
  });

  it('returns Unknown for unrecognized UA', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('SomeWeirdBrowser/1.0');
    expect(getBrowser()).toBe('Unknown');
  });
});

describe('getOS', () => {
  it('detects macOS', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    );
    expect(getOS()).toBe('macOS 10.15');
  });

  it('detects Windows 10/11', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    );
    expect(getOS()).toBe('Windows 10/11');
  });

  it('detects Linux', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
    );
    expect(getOS()).toBe('Linux');
  });

  it('detects Windows 8.1', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36'
    );
    expect(getOS()).toBe('Windows 8.1');
  });

  it('returns Unknown for unrecognized UA', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('SomeWeirdOS/1.0');
    expect(getOS()).toBe('Unknown');
  });
});
