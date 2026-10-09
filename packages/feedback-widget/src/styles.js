/**
 * NoxSpot styles - injected into page
 */

const CSS = `
/* Overlay */
.noxspot-overlay {
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
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.noxspot-overlay-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: #201E1D;
}

.noxspot-overlay-content {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  z-index: 1;
  background: transparent;
}

/* Toolbar */
.noxspot-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #201E1D;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.noxspot-toolbar-tools {
  display: flex;
  align-items: center;
  gap: 8px;
}

.noxspot-close-btn {
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

.noxspot-close-btn:hover {
  background: rgba(255,255,255,0.1);
}

/* Tool buttons */
.noxspot-tool-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.noxspot-tool-divider {
  width: 1px;
  height: 24px;
  background: rgba(255,255,255,0.2);
  margin: 0 8px;
}

.noxspot-tool-btn {
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

.noxspot-tool-btn:hover {
  background: rgba(255,255,255,0.1);
  color: white;
}

.noxspot-tool-btn.active {
  background: #9B78F4;
  color: white;
}

/* Main content area */
.noxspot-main {
  display: flex;
  flex: 1;
  overflow: hidden;
  background: transparent;
}

.noxspot-canvas-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  overflow: auto;
  background: #201E1D;
  min-height: 0;
}

.noxspot-canvas-wrapper {
  position: relative;
  max-width: 100%;
  max-height: 100%;
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.3);
  overflow: hidden;
}

.noxspot-canvas-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: rgba(255, 255, 255, 0.75);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
}

.noxspot-canvas-loading-text {
  letter-spacing: 0.2px;
}

.noxspot-canvas-unavailable {
  max-width: 260px;
  text-align: center;
  line-height: 1.45;
}

.noxspot-canvas-unavailable strong,
.noxspot-canvas-unavailable span {
  display: block;
}

.noxspot-canvas-unavailable strong {
  color: white;
  font-size: 15px;
  margin-bottom: 4px;
}

.noxspot-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.15);
  border-top-color: #FE795D;
  border-radius: 50%;
  animation: noxspot-spin 0.8s linear infinite;
}

@keyframes noxspot-spin {
  to { transform: rotate(360deg); }
}

.noxspot-toolbar-tools--disabled {
  opacity: 0.4;
  pointer-events: none;
}

.noxspot-screenshot {
  display: block;
  max-width: 100%;
  max-height: calc(100vh - 120px);
}

.noxspot-drawing-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  cursor: crosshair;
}

.noxspot-selected-highlights {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 5;
}

/* Sidebar */
.noxspot-sidebar {
  width: 320px;
  background: white;
  border-left: 1px solid rgba(0,0,0,0.1);
  overflow-y: auto;
  flex-shrink: 0;
}

.noxspot-sidebar-content {
  padding: 20px;
}

.noxspot-sidebar-header {
  margin-bottom: 20px;
}

.noxspot-sidebar-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #201E1D;
}

/* Form */
.noxspot-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.noxspot-form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.noxspot-label {
  font-size: 13px;
  font-weight: 500;
  color: #201E1D;
}

.noxspot-input,
.noxspot-textarea {
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.noxspot-input:focus,
.noxspot-textarea:focus {
  outline: none;
  border-color: #FE795D;
  box-shadow: 0 0 0 3px rgba(254, 121, 93, 0.15);
}

.noxspot-textarea {
  resize: vertical;
  min-height: 80px;
}

.noxspot-input--invalid,
.noxspot-input--invalid:focus {
  border-color: #d93025;
  box-shadow: 0 0 0 3px rgba(217, 48, 37, 0.15);
}

.noxspot-field-error {
  font-size: 12px;
  color: #d93025;
  min-height: 0;
}

.noxspot-field-error:empty {
  display: none;
}

/* Metadata display */
.noxspot-metadata {
  background: #f5f5f5;
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 12px;
}

.noxspot-metadata-item {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
}

.noxspot-metadata-item:not(:last-child) {
  border-bottom: 1px solid #e5e5e5;
}

.noxspot-metadata-label {
  color: #666;
  font-weight: 500;
}

.noxspot-metadata-value {
  color: #201E1D;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 160px;
}

.noxspot-hint {
  font-size: 11px;
  color: #888;
  margin: 8px 0 0 0;
  text-align: center;
}

/* Submit button */
.noxspot-submit-btn {
  background: #FE795D;
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

.noxspot-submit-btn:hover {
  background: #e5684d;
}

.noxspot-submit-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.noxspot-submit-row {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.noxspot-submit-row .noxspot-submit-btn {
  flex: 1;
  margin-top: 0;
}

/* Selected elements */
.noxspot-elements-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.noxspot-element-chip {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: #f5f5f5;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 12px;
}

.noxspot-element-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.noxspot-element-attrs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding-top: 4px;
  border-top: 1px solid #e5e5e5;
}

.noxspot-attr-pill {
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

.noxspot-attr-key {
  color: #6b5b95;
  font-weight: 600;
}

.noxspot-element-tag {
  background: #9B78F4;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
}

.noxspot-element-detail {
  flex: 1;
  color: #201E1D;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: monospace;
}

.noxspot-element-remove {
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

.noxspot-element-remove:hover {
  background: rgba(0,0,0,0.1);
  color: #666;
}

/* Custom dropdown */
.noxspot-dropdown {
  position: relative;
}

.noxspot-dropdown-trigger {
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

.noxspot-dropdown-trigger:hover {
  border-color: #ccc;
}

.noxspot-dropdown-chevron {
  flex-shrink: 0;
  color: #888;
  transition: transform 0.2s;
}

.noxspot-dropdown-menu {
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

.noxspot-dropdown-menu.open {
  display: block;
}

.noxspot-dropdown-item {
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

.noxspot-dropdown-item:hover {
  background: #f5f5f5;
}

.noxspot-dropdown-item.selected {
  background: #f0edf9;
  color: #6b5b95;
  font-weight: 500;
}

.noxspot-dropdown-check {
  visibility: hidden;
  flex-shrink: 0;
  color: #9B78F4;
}

.noxspot-dropdown-item.selected .noxspot-dropdown-check {
  visibility: visible;
}

/* Combobox — text input with filtered suggestion menu */
.noxspot-combobox {
  position: relative;
  width: 100%;
}

.noxspot-combobox .noxspot-input {
  width: 100%;
  box-sizing: border-box;
}

.noxspot-dropdown-item.highlighted {
  background: #f5f3fb;
}

.noxspot-dropdown-empty {
  padding: 8px 10px;
  font-size: 12px;
  color: #888;
}

/* ── Mobile (<768px) ── */
@media (max-width: 767px) {
  /* Overlay: stacked column layout */
  .noxspot-overlay-content {
    flex-direction: column;
  }

  .noxspot-main {
    flex-direction: column;
    position: relative;
  }

  /* Toolbar: flex-positioned, sits just below canvas, above Continue */
  .noxspot-toolbar {
    order: 2;
    flex-shrink: 0;
    border-top: 1px solid rgba(255,255,255,0.1);
    border-bottom: none;
    padding: 8px 12px;
  }

  /* Main: takes remaining space, contains canvas + sidebar */
  .noxspot-main {
    order: 1;
    flex: 1;
    min-height: 0;
  }

  /* Canvas area — constrained, no inner scroll */
  .noxspot-canvas-area {
    flex: 1;
    padding: 8px;
    overflow: hidden;
    min-height: 0;
  }

  /* Screenshot sized against overlay bounds via CSS custom props that JS
     sets from window.innerWidth/innerHeight. Avoids 100vw which anchors to
     the (potentially zoomed) layout viewport on iOS. */
  .noxspot-canvas-wrapper {
    max-width: 100%;
    max-height: 100%;
  }

  .noxspot-screenshot {
    display: block;
    max-width: calc(var(--noxspot-vw, 100vw) - 16px);
    max-height: calc(var(--noxspot-vh, 100dvh) - 180px);
    width: auto;
    height: auto;
  }

  /* Sidebar: full-screen overlay, hidden by default */
  .noxspot-sidebar {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    z-index: 5;
    display: none;
    overflow: hidden;
  }
  .noxspot-sidebar.noxspot-sidebar-visible {
    display: flex;
    flex-direction: column;
  }
  .noxspot-sidebar .noxspot-sidebar-content {
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
  .noxspot-sidebar .noxspot-sidebar-content::-webkit-scrollbar {
    display: none;
  }
  .noxspot-sidebar .noxspot-form {
    flex: 1;
    min-height: 0;
    gap: 12px;
  }
  /* Compact form-group spacing on mobile */
  .noxspot-sidebar .noxspot-textarea {
    min-height: 60px;
    resize: none;
  }
  /* Metadata + hint hidden on mobile — server still captures them, user doesn't need to see them */
  .noxspot-sidebar .noxspot-form-group--metadata {
    display: none;
  }
  /* Screenshot thumbnail redundant on mobile — the user just annotated it on step 1 */
  .noxspot-mobile-thumbnail {
    display: none !important;
  }

  /* Submit sits at bottom of form — normal button size, safe-area aware */
  .noxspot-sidebar .noxspot-submit-row {
    position: sticky;
    bottom: 0;
    flex-shrink: 0;
    background: white;
    padding: 8px 0 calc(12px + env(safe-area-inset-bottom)) 0;
    margin-top: auto;
  }

  /* Touch-friendly tool buttons */
  .noxspot-tool-btn {
    width: 44px;
    height: 44px;
    min-width: 44px;
  }

  .noxspot-tool-divider {
    height: 28px;
  }

  /* Hide rectangle tool on mobile */
  .noxspot-tool-btn[data-tool="rectangle"] {
    display: none;
  }

  /* Mobile "Continue" button — compact, bottom-right next to toolbar */
  .noxspot-mobile-next {
    order: 3;
    flex-shrink: 0;
    align-self: stretch;
    margin: 8px 16px calc(8px + env(safe-area-inset-bottom)) 16px;
    background: #FE795D;
    color: white;
    border: none;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  /* Mobile floating close (X) — always visible top-right, closes overlay entirely */
  .noxspot-mobile-close {
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
  .noxspot-mobile-back {
    background: transparent;
    border: none;
    color: #FE795D;
    font-size: 15px;
    font-weight: 500;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    cursor: pointer;
    padding: 6px 8px 6px 0;
    margin-right: 8px;
  }

  /* Mobile screenshot thumbnail in sidebar */
  .noxspot-mobile-thumbnail {
    margin-bottom: 16px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #e5e5e5;
  }
  .noxspot-mobile-thumbnail img {
    display: block;
    width: 120px;
    height: auto;
    border-radius: 8px;
  }
}

`;

export function injectStyles() {
  if (document.getElementById('noxspot-styles')) return;

  const style = document.createElement('style');
  style.id = 'noxspot-styles';
  style.textContent = CSS;
  document.head.appendChild(style);
}
