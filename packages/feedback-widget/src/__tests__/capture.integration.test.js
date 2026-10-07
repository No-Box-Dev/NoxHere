import { describe, it, expect } from 'vitest';
import React from 'react';
import { jsxDEV } from 'react/jsx-dev-runtime';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { resolveElementSource } from '../capture.js';

// End-to-end check: render real React with jsxDEV source info and confirm
// that resolveElementSource picks it up off the live fiber. Mirrors what
// @vitejs/plugin-react emits for every JSX element in dev mode.
describe('resolveElementSource (integration with real React fibers)', () => {
  it('returns a source for a user-code fiber and null for a framework-only element', async () => {
    function Button() {
      return jsxDEV(
        'button',
        { className: 'go', children: 'Click' },
        undefined,
        false,
        { fileName: '/demo-app/src/components/Button.jsx', lineNumber: 42, columnNumber: 5 },
        undefined
      );
    }

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        jsxDEV(
          Button,
          {},
          undefined,
          false,
          { fileName: '/demo-app/src/App.jsx', lineNumber: 10, columnNumber: 3 },
          undefined
        )
      );
    });

    const button = container.querySelector('button.go');
    expect(button).toBeTruthy();

    const source = resolveElementSource(button);
    expect(source).toEqual({
      file: 'src/components/Button.jsx',
      line: 42,
      column: 5,
    });

    // Control: a DOM node created outside React has no fiber and must return null.
    const orphan = document.createElement('div');
    expect(resolveElementSource(orphan)).toBe(null);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
