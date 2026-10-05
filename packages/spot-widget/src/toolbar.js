/**
 * Annotation toolbar
 */

import { setTool, getTool, clearCanvas, undoLast } from './canvas.js';

let toolbarElement = null;
let activeButton = null;
let onToolChangeCallback = null;

// Tool icons (SVG)
const ICONS = {
  arrow: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>`,
  rectangle: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
  </svg>`,
  text: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="4 7 4 4 20 4 20 7"/>
    <line x1="9" y1="20" x2="15" y2="20"/>
    <line x1="12" y1="4" x2="12" y2="20"/>
  </svg>`,
  draw: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 19l7-7 3 3-7 7-3-3z"/>
    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
    <path d="M2 2l7.586 7.586"/>
    <circle cx="11" cy="11" r="2"/>
  </svg>`,
  element: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 3a9 9 0 1 0 9 9"/>
    <circle cx="12" cy="12" r="3"/>
    <path d="M21 3l-6 6"/>
    <path d="M21 9V3h-6"/>
  </svg>`,
  undo: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 7v6h6"/>
    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
  </svg>`,
  clear: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 6h18"/>
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
  </svg>`,
};

/**
 * Create toolbar HTML.
 * `showElementPicker` is opt-out: when the site has no `element_picker`
 * form block, the picker tool is hidden and the toolbar starts on the
 * arrow tool instead.
 * @param {{showElementPicker?: boolean}} [opts]
 * @returns {string} HTML string
 */
export function createToolbarHTML(opts = {}) {
  const showElementPicker = opts.showElementPicker !== false;
  const elementGroup = showElementPicker ? `
    <div class="noxspot-tool-group">
      <button class="noxspot-tool-btn active" data-tool="element" title="Select Element" aria-label="Select element">
        ${ICONS.element}
      </button>
    </div>
    <div class="noxspot-tool-divider"></div>
  ` : '';
  return `
    ${elementGroup}
    <div class="noxspot-tool-group">
      <button class="noxspot-tool-btn${showElementPicker ? '' : ' active'}" data-tool="arrow" title="Arrow" aria-label="Draw arrow">
        ${ICONS.arrow}
      </button>
      <button class="noxspot-tool-btn" data-tool="rectangle" title="Box" aria-label="Draw rectangle">
        ${ICONS.rectangle}
      </button>
      <button class="noxspot-tool-btn" data-tool="text" title="Text" aria-label="Add text">
        ${ICONS.text}
      </button>
      <button class="noxspot-tool-btn" data-tool="draw" title="Freeform" aria-label="Freeform draw">
        ${ICONS.draw}
      </button>
    </div>
    <div class="noxspot-tool-divider"></div>
    <div class="noxspot-tool-group">
      <button class="noxspot-tool-btn" data-action="undo" title="Undo" aria-label="Undo last action">
        ${ICONS.undo}
      </button>
      <button class="noxspot-tool-btn" data-action="clear" title="Clear all" aria-label="Clear all annotations">
        ${ICONS.clear}
      </button>
    </div>
  `;
}

/**
 * Initialize toolbar event listeners
 * @param {HTMLElement} container - The toolbar container element
 * @param {Object} options - Options
 * @param {Function} options.onToolChange - Callback when tool changes, receives tool name
 */
export function initToolbar(container, options = {}) {
  toolbarElement = container;
  onToolChangeCallback = options.onToolChange || null;

  // Tool buttons
  const toolBtns = container.querySelectorAll('[data-tool]');
  toolBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      // Only set canvas tool for drawing tools, not element picker
      if (tool !== 'element') {
        setTool(tool);
      }
      updateActiveButton(btn);
      // Notify listener of tool change
      if (onToolChangeCallback) {
        onToolChangeCallback(tool);
      }
    });
  });

  // Action buttons
  const actionBtns = container.querySelectorAll('[data-action]');
  actionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'undo') {
        undoLast();
      } else if (action === 'clear') {
        clearCanvas();
      }
    });
  });

  // Pick the initial active tool from the rendered HTML — element when
  // present, arrow as the fallback when the picker has been disabled.
  activeButton = container.querySelector('.noxspot-tool-btn.active') || container.querySelector('[data-tool]');
  const initialTool = activeButton?.dataset?.tool;
  if (initialTool && initialTool !== 'element') {
    setTool(initialTool);
  }
  if (initialTool && onToolChangeCallback) {
    onToolChangeCallback(initialTool);
  }
}

/**
 * Programmatically select a tool
 * @param {string} tool - Tool name to select
 */
export function selectTool(tool) {
  const btn = toolbarElement?.querySelector(`[data-tool="${tool}"]`);
  if (btn) {
    if (tool !== 'element') {
      setTool(tool);
    }
    updateActiveButton(btn);
    if (onToolChangeCallback) {
      onToolChangeCallback(tool);
    }
  }
}

function updateActiveButton(btn) {
  if (activeButton) {
    activeButton.classList.remove('active');
  }
  btn.classList.add('active');
  activeButton = btn;
}

/**
 * Cleanup toolbar
 */
export function destroyToolbar() {
  toolbarElement = null;
  activeButton = null;
  onToolChangeCallback = null;
}
