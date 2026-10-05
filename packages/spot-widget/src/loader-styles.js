/**
 * Styles shipped in the loader bundle — trigger button and toast only.
 *
 * Everything else (overlay, canvas, sidebar, form, etc.) lives in styles.js
 * and is injected by the core bundle the first time it loads.
 */

const CSS = `
.noxspot-trigger {
  position: fixed;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 2147483647;
  background: #FE795D;
  color: white;
  border: none;
  padding: 16px 10px 12px 10px;
  border-radius: 8px 0 0 8px;
  cursor: pointer;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px;
  font-weight: 500;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  box-shadow: -2px 2px 8px rgba(0,0,0,0.15);
  transition: background 0.2s ease;
}

.noxspot-trigger:hover {
  background: #e5684d;
}

.noxspot-trigger svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.noxspot-trigger-text {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  letter-spacing: 0.5px;
}

.noxspot-trigger-shortcut {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.5px;
  padding: 3px 4px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.18);
  color: rgba(255, 255, 255, 0.95);
}

.noxspot-trigger-dots {
  display: flex;
  flex-direction: column;
  gap: 3px;
  opacity: 0.7;
}

.noxspot-trigger-dots span {
  width: 4px;
  height: 4px;
  background: white;
  border-radius: 50%;
}

/* Toast — optimistic submit feedback */
.noxspot-toast {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 2147483646;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: #201E1D;
  color: white;
  border-radius: 8px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 4px 16px rgba(0,0,0,0.2);
  opacity: 0;
  transform: translateY(-8px);
  transition: opacity 200ms ease, transform 200ms ease;
  pointer-events: auto;
  max-width: calc(100vw - 48px);
}

.noxspot-toast--visible {
  opacity: 1;
  transform: translateY(0);
}

.noxspot-toast--success {
  background: #16a34a;
}

.noxspot-toast-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.noxspot-toast--success .noxspot-toast-dot {
  background: white;
}

.noxspot-toast--error .noxspot-toast-dot {
  background: #ef4444;
}

.noxspot-toast-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.noxspot-toast-action {
  background: transparent;
  border: 1px solid rgba(255,255,255,0.3);
  color: white;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  margin-left: 4px;
  transition: background 0.15s;
}

.noxspot-toast-action:hover {
  background: rgba(255,255,255,0.1);
}

/* Mobile: trigger becomes a circular FAB, lifted above iOS safe area */
@media (max-width: 767px) {
  .noxspot-trigger {
    position: fixed;
    bottom: calc(20px + env(safe-area-inset-bottom));
    right: 20px;
    top: auto;
    transform: none;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    padding: 0;
    justify-content: center;
  }
  .noxspot-trigger-text,
  .noxspot-trigger-shortcut,
  .noxspot-trigger-dots {
    display: none;
  }
  .noxspot-trigger svg {
    width: 26px;
    height: 26px;
  }
}
`;

export function injectLoaderStyles() {
  if (document.getElementById('noxspot-loader-styles')) return;
  const style = document.createElement('style');
  style.id = 'noxspot-loader-styles';
  style.textContent = CSS;
  document.head.appendChild(style);
}

export function removeLoaderStyles() {
  const style = document.getElementById('noxspot-loader-styles');
  if (style) style.remove();
}
