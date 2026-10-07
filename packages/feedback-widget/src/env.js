/**
 * Pure environment helpers — safe to inline into both loader and core bundles.
 * No module state; same input always returns same output.
 */

export function getBrowser() {
  const ua = navigator.userAgent;

  if (ua.includes('Firefox/')) {
    const match = ua.match(/Firefox\/(\d+)/);
    return `Firefox ${match ? match[1] : ''}`;
  }
  if (ua.includes('Edg/')) {
    const match = ua.match(/Edg\/(\d+)/);
    return `Edge ${match ? match[1] : ''}`;
  }
  if (ua.includes('Chrome/')) {
    const match = ua.match(/Chrome\/(\d+)/);
    return `Chrome ${match ? match[1] : ''}`;
  }
  if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    const match = ua.match(/Version\/(\d+)/);
    return `Safari ${match ? match[1] : ''}`;
  }

  return 'Unknown';
}

export function getOS() {
  const ua = navigator.userAgent;

  if (ua.includes('Mac OS X')) {
    const match = ua.match(/Mac OS X (\d+[._]\d+)/);
    if (match) {
      return `macOS ${match[1].replace('_', '.')}`;
    }
    return 'macOS';
  }
  if (ua.includes('Windows NT 10')) return 'Windows 10/11';
  if (ua.includes('Windows NT 6.3')) return 'Windows 8.1';
  if (ua.includes('Windows NT 6.2')) return 'Windows 8';
  if (ua.includes('Windows NT 6.1')) return 'Windows 7';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';

  return 'Unknown';
}

/**
 * Extract entity-like segments from the URL path
 * Pairs label+ID segments: /users/123/reports/456 → { users: "123", reports: "456" }
 */
export function extractUrlEntities() {
  const entities = {};
  const path = window.location.pathname;
  const segments = path.split('/').filter(Boolean);

  const isId = (segment) =>
    /^\d+$/.test(segment) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment) ||
    /^[0-9a-f]{8,}$/i.test(segment);

  for (let i = 0; i < segments.length; i++) {
    if (isId(segments[i]) && i > 0) {
      entities[segments[i - 1]] = segments[i];
    }
  }

  return entities;
}
