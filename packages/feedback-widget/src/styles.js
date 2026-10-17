/**
 * Feedback styles - injected into page
 */

const CSS = `
/* Overlay */
.feedback-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  /* JS sets explicit width/height based on window.innerWidth/innerHeight so
     the overlay can't exceed the visual viewport even when iOS reports a
     wider layout viewport (pinch-zoom, input-focus zoom). Left/right/bottom
     are fallbacks if JS hasn't run yet. */
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  z-index: 2147483647;
  font-family: var(--feedback-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
}

.feedback-overlay-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: #201E1D;
}

.feedback-overlay-content {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  z-index: 1;
  background: transparent;
}

/* Toolbar */
.feedback-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #201E1D;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.feedback-toolbar-tools {
  display: flex;
  align-items: center;
  gap: 8px;
}

.feedback-close-btn {
  background: transparent;
  border: none;
  color: white;
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.feedback-close-btn:hover {
  background: rgba(255,255,255,0.1);
}

/* Tool buttons */
.feedback-tool-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.feedback-tool-divider {
  width: 1px;
  height: 24px;
  background: rgba(255,255,255,0.2);
  margin: 0 8px;
}

.feedback-tool-btn {
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.7);
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, color 0.2s;
}

.feedback-tool-btn:hover {
  background: rgba(255,255,255,0.1);
  color: white;
}

.feedback-tool-btn.active {
  background: #9B78F4;
  color: white;
}

/* Main content area */
.feedback-main {
  display: flex;
  flex: 1;
  overflow: hidden;
  background: transparent;
}

.feedback-canvas-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  overflow: auto;
  background: #201E1D;
  min-height: 0;
}

.feedback-canvas-wrapper {
  position: relative;
  max-width: 100%;
  max-height: 100%;
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.3);
  overflow: hidden;
}

.feedback-canvas-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: rgba(255, 255, 255, 0.75);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
}

.feedback-canvas-loading-text {
  letter-spacing: 0.2px;
}

.feedback-canvas-unavailable {
  max-width: 260px;
  text-align: center;
  line-height: 1.45;
}

.feedback-canvas-unavailable strong,
.feedback-canvas-unavailable span {
  display: block;
}

.feedback-canvas-unavailable strong {
  color: white;
  font-size: 15px;
  margin-bottom: 4px;
}

.feedback-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.15);
  border-top-color: var(--feedback-accent, #FE795D);
  border-radius: 50%;
  animation: feedback-spin 0.8s linear infinite;
}

@keyframes feedback-spin {
  to { transform: rotate(360deg); }
}

.feedback-toolbar-tools--disabled {
  opacity: 0.4;
  pointer-events: none;
}

.feedback-screenshot {
  display: block;
  max-width: 100%;
  max-height: calc(100vh - 120px);
}

.feedback-drawing-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  cursor: crosshair;
}

.feedback-selected-highlights {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 5;
}

/* Sidebar */
.feedback-sidebar {
  width: 320px;
  background: white;
  border-left: 1px solid rgba(0,0,0,0.1);
  overflow-y: auto;
  flex-shrink: 0;
}

.feedback-sidebar-content {
  padding: 20px;
}

.feedback-sidebar-header {
  margin-bottom: 20px;
}

.feedback-sidebar-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #201E1D;
}

.feedback-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  color: #201E1D;
  font-size: 13px;
  font-weight: 600;
}

.feedback-brand img {
  width: auto;
  height: 24px;
  max-width: 72px;
  object-fit: contain;
  border-radius: 0;
}

/* Form */
.feedback-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.feedback-form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.feedback-label {
  font-size: 13px;
  font-weight: 500;
  color: #201E1D;
}

.feedback-input,
.feedback-textarea {
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.feedback-input:focus,
.feedback-textarea:focus {
  outline: none;
  border-color: var(--feedback-accent, #FE795D);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--feedback-accent, #FE795D) 15%, transparent);
}

.feedback-textarea {
  resize: vertical;
  min-height: 80px;
}

.feedback-input--invalid,
.feedback-input--invalid:focus {
  border-color: #d93025;
  box-shadow: 0 0 0 3px rgba(217, 48, 37, 0.15);
}

.feedback-field-error {
  font-size: 12px;
  color: #d93025;
  min-height: 0;
}

.feedback-field-error:empty {
  display: none;
}

.feedback-hint {
  font-size: 11px;
  color: #888;
  margin: 8px 0 0 0;
  text-align: center;
}

/* Submit button */
.feedback-submit-btn {
  background: var(--feedback-accent, #FE795D);
  color: white;
  border: none;
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  margin-top: 8px;
}

.feedback-submit-btn:hover {
  background: var(--feedback-accent, #FE795D);
  filter: brightness(.9);
}

.feedback-submit-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.feedback-submit-row {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.feedback-submit-row .feedback-submit-btn {
  flex: 1;
  margin-top: 0;
}

/* Selected elements */
.feedback-elements-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.feedback-element-chip {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: #f5f5f5;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 12px;
}

.feedback-element-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.feedback-element-attrs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding-top: 4px;
  border-top: 1px solid #e5e5e5;
}

.feedback-attr-pill {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: #eee;
  border-radius: 8px;
  padding: 2px 7px;
  font-size: 10px;
  color: #555;
  font-family: monospace;
}

.feedback-attr-key {
  color: #6b5b95;
  font-weight: 600;
}

.feedback-element-tag {
  background: #9B78F4;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
}

.feedback-element-detail {
  flex: 1;
  color: #201E1D;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: monospace;
}

.feedback-element-remove {
  background: transparent;
  border: none;
  color: #999;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, color 0.2s;
}

.feedback-element-remove:hover {
  background: rgba(0,0,0,0.1);
  color: #666;
}

/* Custom dropdown */
.feedback-dropdown {
  position: relative;
}

.feedback-dropdown-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  background: white;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
  color: #201E1D;
}

.feedback-dropdown-trigger:hover {
  border-color: #ccc;
}

.feedback-dropdown-chevron {
  flex-shrink: 0;
  color: #888;
  transition: transform 0.2s;
}

.feedback-dropdown-menu {
  display: none;
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  z-index: 10;
  max-height: 220px;
  overflow-y: auto;
  padding: 4px;
}

.feedback-dropdown-menu.open {
  display: block;
}

.feedback-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 5px;
  font-size: 14px;
  cursor: pointer;
  color: #201E1D;
  transition: background 0.15s;
}

.feedback-dropdown-item:hover {
  background: #f5f5f5;
}

.feedback-dropdown-item.selected {
  background: #f0edf9;
  color: #6b5b95;
  font-weight: 500;
}

.feedback-dropdown-check {
  visibility: hidden;
  flex-shrink: 0;
  color: #9B78F4;
}

.feedback-dropdown-item.selected .feedback-dropdown-check {
  visibility: visible;
}

/* Combobox — text input with filtered suggestion menu */
.feedback-combobox {
  position: relative;
  width: 100%;
}

.feedback-combobox .feedback-input {
  width: 100%;
  box-sizing: border-box;
}

.feedback-dropdown-item.highlighted {
  background: #f5f3fb;
}

.feedback-dropdown-empty {
  padding: 8px 10px;
  font-size: 12px;
  color: #888;
}

/* ── Mobile (<768px) ── */
@media (max-width: 767px) {
  /* Overlay: stacked column layout */
  .feedback-overlay-content {
    flex-direction: column;
  }

  .feedback-main {
    flex-direction: column;
    position: relative;
  }

  /* Toolbar: flex-positioned, sits just below canvas, above Continue */
  .feedback-toolbar {
    order: 2;
    flex-shrink: 0;
    border-top: 1px solid rgba(255,255,255,0.1);
    border-bottom: none;
    padding: 8px 12px;
  }

  /* Main: takes remaining space, contains canvas + sidebar */
  .feedback-main {
    order: 1;
    flex: 1;
    min-height: 0;
  }

  /* Canvas area — constrained, no inner scroll */
  .feedback-canvas-area {
    flex: 1;
    padding: 8px;
    overflow: hidden;
    min-height: 0;
  }

  /* Screenshot sized against overlay bounds via CSS custom props that JS
     sets from window.innerWidth/innerHeight. Avoids 100vw which anchors to
     the (potentially zoomed) layout viewport on iOS. */
  .feedback-canvas-wrapper {
    max-width: 100%;
    max-height: 100%;
  }

  .feedback-screenshot {
    display: block;
    max-width: calc(var(--feedback-vw, 100vw) - 16px);
    max-height: calc(var(--feedback-vh, 100dvh) - 180px);
    width: auto;
    height: auto;
  }

  /* Sidebar: full-screen overlay, hidden by default */
  .feedback-sidebar {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    z-index: 5;
    display: none;
    overflow: hidden;
  }
  .feedback-sidebar.feedback-sidebar-visible {
    display: flex;
    flex-direction: column;
  }
  .feedback-sidebar .feedback-sidebar-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    padding: calc(16px + env(safe-area-inset-top)) 20px 0 20px;
    scrollbar-width: none;
  }
  .feedback-sidebar .feedback-sidebar-content::-webkit-scrollbar {
    display: none;
  }
  .feedback-sidebar .feedback-form {
    flex: 1;
    min-height: 0;
    gap: 12px;
  }
  /* Compact form-group spacing on mobile */
  .feedback-sidebar .feedback-textarea {
    min-height: 60px;
    resize: none;
  }
  /* Screenshot thumbnail redundant on mobile — the user just annotated it on step 1 */
  .feedback-mobile-thumbnail {
    display: none !important;
  }

  /* Submit sits at bottom of form — normal button size, safe-area aware */
  .feedback-sidebar .feedback-submit-row {
    position: sticky;
    bottom: 0;
    flex-shrink: 0;
    background: white;
    padding: 8px 0 calc(12px + env(safe-area-inset-bottom)) 0;
    margin-top: auto;
  }

  /* Touch-friendly tool buttons */
  .feedback-tool-btn {
    width: 44px;
    height: 44px;
    min-width: 44px;
  }

  .feedback-tool-divider {
    height: 28px;
  }

  /* Hide rectangle tool on mobile */
  .feedback-tool-btn[data-tool="rectangle"] {
    display: none;
  }

  /* Mobile "Continue" button — compact, bottom-right next to toolbar */
  .feedback-mobile-next {
    order: 3;
    flex-shrink: 0;
    align-self: stretch;
    margin: 8px 16px calc(8px + env(safe-area-inset-bottom)) 16px;
    background: var(--feedback-accent, #FE795D);
    color: white;
    border: none;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
    font-family: var(--feedback-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  /* Mobile floating close (X) — always visible top-right, closes overlay entirely */
  .feedback-mobile-close {
    position: fixed;
    top: calc(12px + env(safe-area-inset-top));
    right: 12px;
    z-index: 12;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(32, 30, 29, 0.85);
    color: white;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  }

  /* Mobile "← Back" button — larger tap target */
  .feedback-mobile-back {
    background: transparent;
    border: none;
    color: var(--feedback-accent, #FE795D);
    font-size: 15px;
    font-weight: 500;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    cursor: pointer;
    padding: 6px 8px 6px 0;
    margin-right: 8px;
  }

  /* Mobile screenshot thumbnail in sidebar */
  .feedback-mobile-thumbnail {
    margin-bottom: 16px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #e5e5e5;
  }
  .feedback-mobile-thumbnail img {
    display: block;
    width: 120px;
    height: auto;
    border-radius: 8px;
  }
}

`;

export function injectStyles() {
  if (document.getElementById('feedback-styles')) return;

  const style = document.createElement('style');
  style.id = 'feedback-styles';
  style.textContent = CSS;
  document.head.appendChild(style);
}
