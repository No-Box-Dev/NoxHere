/**
 * Styles shipped in the loader bundle — trigger button and toast only.
 *
 * Everything else (overlay, canvas, sidebar, form, etc.) lives in styles.js
 * and is injected by the core bundle the first time it loads.
 */

const CSS = `
.feedback-trigger {
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

.feedback-trigger[data-feedback-desktop-position="top-left"] {
  top: 20px;
  right: auto;
  bottom: auto;
  left: 0;
  transform: none;
}

.feedback-trigger[data-feedback-desktop-position="center-left"] {
  top: 50%;
  right: auto;
  bottom: auto;
  left: 0;
  transform: translateY(-50%);
}

.feedback-trigger[data-feedback-desktop-position="bottom-left"] {
  top: auto;
  right: auto;
  bottom: 20px;
  left: 0;
  transform: none;
}

.feedback-trigger[data-feedback-desktop-position="top-right"] {
  top: 20px;
  right: 0;
  bottom: auto;
  left: auto;
  transform: none;
}

.feedback-trigger[data-feedback-desktop-position="center-right"] {
  top: 50%;
  right: 0;
  bottom: auto;
  left: auto;
  transform: translateY(-50%);
}

.feedback-trigger[data-feedback-desktop-position="bottom-right"] {
  top: auto;
  right: 0;
  bottom: 20px;
  left: auto;
  transform: none;
}

.feedback-trigger[data-feedback-desktop-position$="-left"][data-feedback-desktop-style="tab"] {
  border-radius: 0 8px 8px 0;
  box-shadow: 2px 2px 8px rgba(0,0,0,0.15);
}

.feedback-trigger[data-feedback-desktop-style="button"] {
  width: 56px;
  height: 56px;
  padding: 0;
  border-radius: 50%;
  justify-content: center;
}

.feedback-trigger[data-feedback-desktop-style="button"][data-feedback-desktop-position$="-left"] {
  left: 20px;
}

.feedback-trigger[data-feedback-desktop-style="button"][data-feedback-desktop-position$="-right"] {
  right: 20px;
}

.feedback-trigger[data-feedback-desktop-style="button"] .feedback-trigger-text,
.feedback-trigger[data-feedback-desktop-style="button"] .feedback-trigger-shortcut,
.feedback-trigger[data-feedback-desktop-style="button"] .feedback-trigger-dots {
  display: none;
}

.feedback-trigger[data-feedback-desktop-style="button"] svg {
  width: 24px;
  height: 24px;
}

.feedback-trigger:hover {
  background: #e5684d;
}

.feedback-trigger svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.feedback-trigger-text {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  letter-spacing: 0.5px;
}

.feedback-trigger-shortcut {
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

.feedback-trigger-dots {
  display: flex;
  flex-direction: column;
  gap: 3px;
  opacity: 0.7;
}

.feedback-trigger-dots span {
  width: 4px;
  height: 4px;
  background: white;
  border-radius: 50%;
}

/* Toast — optimistic submit feedback */
.feedback-toast {
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

.feedback-toast--visible {
  opacity: 1;
  transform: translateY(0);
}

.feedback-toast--success {
  background: #16a34a;
}

.feedback-toast-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.feedback-toast--success .feedback-toast-dot {
  background: white;
}

.feedback-toast--error .feedback-toast-dot {
  background: #ef4444;
}

.feedback-toast-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.feedback-toast-action {
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

.feedback-toast-action:hover {
  background: rgba(255,255,255,0.1);
}

/* Mobile defaults remain a circular FAB. Every site can independently choose
   a side tab and any edge position without host-page CSS overrides. */
@media (max-width: 767px) {
  .feedback-trigger {
    position: fixed;
    top: auto;
    right: 20px;
    bottom: calc(20px + env(safe-area-inset-bottom));
    left: auto;
    transform: none;
  }

  .feedback-trigger[data-feedback-mobile-position="top-left"] {
    top: calc(20px + env(safe-area-inset-top));
    right: auto;
    bottom: auto;
    left: 20px;
    transform: none;
  }

  .feedback-trigger[data-feedback-mobile-position="center-left"] {
    top: 50%;
    right: auto;
    bottom: auto;
    left: 20px;
    transform: translateY(-50%);
  }

  .feedback-trigger[data-feedback-mobile-position="bottom-left"] {
    top: auto;
    right: auto;
    bottom: calc(20px + env(safe-area-inset-bottom));
    left: 20px;
    transform: none;
  }

  .feedback-trigger[data-feedback-mobile-position="top-right"] {
    top: calc(20px + env(safe-area-inset-top));
    right: 20px;
    bottom: auto;
    left: auto;
    transform: none;
  }

  .feedback-trigger[data-feedback-mobile-position="center-right"] {
    top: 50%;
    right: 20px;
    bottom: auto;
    left: auto;
    transform: translateY(-50%);
  }

  .feedback-trigger[data-feedback-mobile-position="bottom-right"] {
    top: auto;
    right: 20px;
    bottom: calc(20px + env(safe-area-inset-bottom));
    left: auto;
    transform: none;
  }

  .feedback-trigger[data-feedback-mobile-style="button"] {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    padding: 0;
    justify-content: center;
  }

  .feedback-trigger[data-feedback-mobile-style="button"] .feedback-trigger-text,
  .feedback-trigger[data-feedback-mobile-style="button"] .feedback-trigger-shortcut,
  .feedback-trigger[data-feedback-mobile-style="button"] .feedback-trigger-dots {
    display: none;
  }

  .feedback-trigger[data-feedback-mobile-style="button"] svg {
    width: 26px;
    height: 26px;
  }

  .feedback-trigger[data-feedback-mobile-style="tab"] {
    width: auto;
    height: auto;
    padding: 14px 9px 10px;
    border-radius: 8px 0 0 8px;
    justify-content: flex-start;
  }

  .feedback-trigger[data-feedback-mobile-style="tab"][data-feedback-mobile-position$="-left"] {
    left: 0;
    border-radius: 0 8px 8px 0;
    box-shadow: 2px 2px 8px rgba(0,0,0,0.15);
  }

  .feedback-trigger[data-feedback-mobile-style="tab"][data-feedback-mobile-position$="-right"] {
    right: 0;
  }

  .feedback-trigger[data-feedback-mobile-style="tab"] .feedback-trigger-text,
  .feedback-trigger[data-feedback-mobile-style="tab"] .feedback-trigger-dots {
    display: flex;
  }

  .feedback-trigger[data-feedback-mobile-style="tab"] .feedback-trigger-shortcut {
    display: none !important;
  }

  .feedback-trigger[data-feedback-mobile-style="tab"] svg {
    width: 18px;
    height: 18px;
  }
}
`;

export function injectLoaderStyles() {
  if (document.getElementById('feedback-loader-styles')) return;
  const style = document.createElement('style');
  style.id = 'feedback-loader-styles';
  style.textContent = CSS;
  document.head.appendChild(style);
}

export function removeLoaderStyles() {
  const style = document.getElementById('feedback-loader-styles');
  if (style) style.remove();
}
