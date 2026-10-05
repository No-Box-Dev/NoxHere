/**
 * Tiny toast — bottom-right, fades in, auto-dismisses.
 * Used for optimistic submit feedback.
 */

let activeToast = null;

export function showToast({ message, variant = 'success', durationMs = 1800, action = null }) {
  dismissToast();

  const toast = document.createElement('div');
  toast.className = `noxspot-toast noxspot-toast--${variant}`;
  toast.setAttribute('role', variant === 'error' ? 'alert' : 'status');

  const dot = document.createElement('span');
  dot.className = 'noxspot-toast-dot';
  toast.appendChild(dot);

  const text = document.createElement('span');
  text.className = 'noxspot-toast-text';
  text.textContent = message;
  toast.appendChild(text);

  if (action && typeof action.onClick === 'function') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'noxspot-toast-action';
    btn.textContent = action.label || 'Retry';
    btn.addEventListener('click', () => {
      dismissToast();
      action.onClick();
    });
    toast.appendChild(btn);
  }

  document.body.appendChild(toast);
  activeToast = toast;

  requestAnimationFrame(() => {
    if (toast.isConnected) toast.classList.add('noxspot-toast--visible');
  });

  if (durationMs > 0) {
    setTimeout(() => {
      if (activeToast === toast) dismissToast();
    }, durationMs);
  }

  return toast;
}

export function dismissToast() {
  if (!activeToast) return;
  const t = activeToast;
  activeToast = null;
  t.classList.remove('noxspot-toast--visible');
  setTimeout(() => t.remove(), 200);
}
