// Minimum stable releases from the 2026-10-21 Node.js security release.
// https://nodejs.org/en/blog/vulnerability/october-2026-security-releases
const minimumByMajor = new Map([[22, [23, 4]], [24, [22, 1]], [26, [12, 1]]]);

export function isSupportedNodeVersion(version) {
  if (typeof version !== 'string') return false;
  const match = version.match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
  if (!match || match[0] !== version) return false;
  const [major, minor, patch] = version.split('.').map(Number);
  if (![major, minor, patch].every(Number.isSafeInteger)) return false;
  const minimum = minimumByMajor.get(major);
  return minimum !== undefined && (minor > minimum[0] || (minor === minimum[0] && patch >= minimum[1]));
}

export function assertSupportedNodeVersion(version) {
  if (!isSupportedNodeVersion(version)) {
    throw new Error(`Unsupported Node.js ${version}. Use stable Node.js 22.23.4+ (22.x), 24.22.1+ (24.x), or 26.12.1+ (26.x). Repository default: 22.23.4. Upgrade Node.js before installing dependencies or running network, build, or deployment tools.`);
  }
}
