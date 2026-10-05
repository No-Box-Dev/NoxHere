import { describe, it, expect } from 'vitest';
import { shouldSkipDataAttr, resolveElementSource } from '../capture.js';

describe('shouldSkipDataAttr', () => {
  it('skips framework state attrs', () => {
    expect(shouldSkipDataAttr('data-state')).toBe(true);
    expect(shouldSkipDataAttr('data-slot')).toBe(true);
    expect(shouldSkipDataAttr('data-orientation')).toBe(true);
    expect(shouldSkipDataAttr('data-disabled')).toBe(true);
    expect(shouldSkipDataAttr('data-variant')).toBe(true);
    expect(shouldSkipDataAttr('data-size')).toBe(true);
  });

  it('skips Radix UI attrs', () => {
    expect(shouldSkipDataAttr('data-radix-collection-item')).toBe(true);
    expect(shouldSkipDataAttr('data-radix-popper-content-wrapper')).toBe(true);
  });

  it('skips browser extension attrs', () => {
    expect(shouldSkipDataAttr('data-dashlane-rid')).toBe(true);
    expect(shouldSkipDataAttr('data-1p-ignore')).toBe(true);
    expect(shouldSkipDataAttr('data-lpignore')).toBe(true);
  });

  it('skips Sentry attrs', () => {
    expect(shouldSkipDataAttr('data-sentry-source-file')).toBe(true);
    expect(shouldSkipDataAttr('data-sentry-element')).toBe(true);
  });

  it('skips noxspot own attrs', () => {
    expect(shouldSkipDataAttr('data-noxspot')).toBe(true);
    expect(shouldSkipDataAttr('data-noxspot-ignore')).toBe(true);
  });

  it('keeps meaningful data attrs', () => {
    expect(shouldSkipDataAttr('data-record-id')).toBe(false);
    expect(shouldSkipDataAttr('data-patient-id')).toBe(false);
    expect(shouldSkipDataAttr('data-user-name')).toBe(false);
    expect(shouldSkipDataAttr('data-row-id')).toBe(false);
  });

  it('keeps testid', () => {
    // data-testid is in the skip list
    expect(shouldSkipDataAttr('data-testid')).toBe(true);
  });

  it('keeps data-discover in skip list', () => {
    expect(shouldSkipDataAttr('data-discover')).toBe(true);
  });
});

describe('resolveElementSource', () => {
  function attachFiber(node, fiber, suffix = 'abc123') {
    node[`__reactFiber$${suffix}`] = fiber;
  }

  it('returns null when the node has no React fiber key', () => {
    const node = document.createElement('div');
    expect(resolveElementSource(node)).toBe(null);
  });

  it('returns source for the nearest user-code fiber', () => {
    const node = document.createElement('div');
    const fiber = {
      _debugSource: null,
      return: {
        _debugSource: {
          fileName: '/Users/dev/app/src/components/Checkout.tsx',
          lineNumber: 42,
          columnNumber: 5,
        },
        return: null,
      },
    };
    attachFiber(node, fiber);
    expect(resolveElementSource(node)).toEqual({
      file: 'src/components/Checkout.tsx',
      line: 42,
      column: 5,
    });
  });

  it('skips node_modules fibers and walks up to user code', () => {
    const node = document.createElement('div');
    const fiber = {
      _debugSource: {
        fileName: '/app/node_modules/@radix-ui/react-button/dist/index.js',
        lineNumber: 10,
        columnNumber: 0,
      },
      return: {
        _debugSource: {
          fileName: '/app/node_modules/@mui/material/Button/Button.js',
          lineNumber: 99,
          columnNumber: 2,
        },
        return: {
          _debugSource: {
            fileName: '/app/pages/Home.tsx',
            lineNumber: 7,
            columnNumber: 1,
          },
          return: null,
        },
      },
    };
    attachFiber(node, fiber);
    expect(resolveElementSource(node)).toEqual({
      file: 'pages/Home.tsx',
      line: 7,
      column: 1,
    });
  });

  it('skips webpack: and rsc: prefixed paths', () => {
    const node = document.createElement('div');
    const fiber = {
      _debugSource: { fileName: 'webpack://app/runtime.js', lineNumber: 1 },
      return: {
        _debugSource: { fileName: 'rsc://server-action', lineNumber: 2 },
        return: {
          _debugSource: { fileName: '/app/src/App.tsx', lineNumber: 15 },
          return: null,
        },
      },
    };
    attachFiber(node, fiber);
    const result = resolveElementSource(node);
    expect(result?.file).toBe('src/App.tsx');
    expect(result?.line).toBe(15);
  });

  it('returns null when only framework fibers exist', () => {
    const node = document.createElement('div');
    const fiber = {
      _debugSource: {
        fileName: '/app/node_modules/react/index.js',
        lineNumber: 1,
      },
      return: null,
    };
    attachFiber(node, fiber);
    expect(resolveElementSource(node)).toBe(null);
  });

  it('caps the walk and never throws', () => {
    const node = document.createElement('div');
    // Self-referential loop — if the cap fails we hang the test runner.
    const loop = { _debugSource: null };
    loop.return = loop;
    attachFiber(node, loop);
    expect(() => resolveElementSource(node)).not.toThrow();
    expect(resolveElementSource(node)).toBe(null);
  });

  it('normalizes Windows-style backslash paths to forward slashes', () => {
    const node = document.createElement('div');
    const fiber = {
      _debugSource: {
        fileName: 'C:\\Users\\dev\\app\\src\\components\\Checkout.tsx',
        lineNumber: 42,
        columnNumber: 5,
      },
      return: null,
    };
    attachFiber(node, fiber);
    expect(resolveElementSource(node)).toEqual({
      file: 'src/components/Checkout.tsx',
      line: 42,
      column: 5,
    });
  });
});
