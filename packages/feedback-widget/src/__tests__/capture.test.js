import { describe, it, expect, vi } from 'vitest';
import { shouldSkipDataAttr, resolveElementSource, captureElementMap, collectNearbyDataAttributes } from '../capture.js';

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

describe('bounded capture metadata', () => {
  it('rejects off-screen table-row subtrees before reading every cell style', () => {
    const table = document.createElement('table');
    const body = document.createElement('tbody');
    table.appendChild(body);
    for (let rowIndex = 0; rowIndex < 2_000; rowIndex += 1) {
      const row = document.createElement('tr');
      row.dataset.row = String(rowIndex);
      for (let column = 0; column < 8; column += 1) {
        const cell = document.createElement('td');
        cell.textContent = `${rowIndex}:${column}`;
        row.appendChild(cell);
      }
      body.appendChild(row);
    }
    document.body.appendChild(table);

    const originalRect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
      if (this.tagName === 'TR') {
        const row = Number(this.dataset.row);
        const top = row === 0 ? 10 : 2_000 + row * 24;
        return { top, bottom: top + 24, left: 0, right: 800, width: 800, height: 24, x: 0, y: top, toJSON() {} };
      }
      return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {} };
    };
    const styleSpy = vi.spyOn(window, 'getComputedStyle');

    try {
      expect(() => captureElementMap()).not.toThrow();
      expect(styleSpy.mock.calls.length).toBeLessThan(100);
    } finally {
      styleSpy.mockRestore();
      Element.prototype.getBoundingClientRect = originalRect;
      table.remove();
    }
  });

  it('collects nearby row data without scanning an entire table', () => {
    const table = document.createElement('table');
    table.innerHTML = `<tbody>${Array.from({ length: 250 }, (_, index) =>
      `<tr data-row-id="${index}"><td><button${index === 200 ? ' id="target"' : ''}>Open</button></td></tr>`
    ).join('')}</tbody>`;
    document.body.appendChild(table);
    const target = table.querySelector('#target');

    const result = collectNearbyDataAttributes(target);

    expect(result['data-row-id']).toBe('200');
    table.remove();
  });
});
