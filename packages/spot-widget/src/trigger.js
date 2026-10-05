/**
 * Trigger button - side tab on right edge
 */

// Paperclip/attachment icon SVG
const CLIP_ICON = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
</svg>
`;

import { debugLog } from './debug.js';

let triggerButton = null;
let onTriggerCallback = null;

export function createTrigger(onTrigger, options = {}) {
  if (triggerButton) return triggerButton;

  onTriggerCallback = onTrigger;

  const color = options.color || '#FE795D';
  const text = options.text || 'Report issue';
  const shortcut = options.shortcut || '';

  triggerButton = document.createElement('button');
  triggerButton.className = 'noxspot-trigger';
  triggerButton.innerHTML = `
    ${CLIP_ICON}
    <span class="noxspot-trigger-text"></span>
    <span class="noxspot-trigger-shortcut"></span>
    <span class="noxspot-trigger-dots">
      <span></span>
      <span></span>
      <span></span>
    </span>
  `;
  triggerButton.querySelector('.noxspot-trigger-text').textContent = text;
  const shortcutEl = triggerButton.querySelector('.noxspot-trigger-shortcut');
  shortcutEl.textContent = shortcut;
  shortcutEl.style.display = shortcut ? '' : 'none';
  triggerButton.setAttribute('aria-label', shortcut ? `${text} (${shortcut})` : text);
  if (shortcut) triggerButton.title = `${text} (${shortcut})`;

  // Apply custom color
  triggerButton.style.background = color;
  triggerButton.dataset.color = color;

  triggerButton.addEventListener('click', handleClick);

  document.body.appendChild(triggerButton);
  return triggerButton;
}

export function darkenColor(hex, percent) {
  // Remove # if present
  hex = hex.replace('#', '');

  // Parse RGB
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);

  // Darken
  r = Math.max(0, Math.floor(r * (100 - percent) / 100));
  g = Math.max(0, Math.floor(g * (100 - percent) / 100));
  b = Math.max(0, Math.floor(b * (100 - percent) / 100));

  // Convert back to hex
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function handleClick() {
  debugLog('[NoxSpot] Trigger clicked');
  if (onTriggerCallback) {
    onTriggerCallback();
  }
}

export function updateTrigger(options = {}) {
  if (!triggerButton) return;
  if (options.color) {
    triggerButton.style.background = options.color;
    triggerButton.dataset.color = options.color;
  }
  if (options.text) {
    const textEl = triggerButton.querySelector('.noxspot-trigger-text');
    if (textEl) textEl.textContent = options.text;
    const shortcut = triggerButton.querySelector('.noxspot-trigger-shortcut')?.textContent || '';
    triggerButton.setAttribute('aria-label', shortcut ? `${options.text} (${shortcut})` : options.text);
    if (shortcut) triggerButton.title = `${options.text} (${shortcut})`;
  }
}

export function getTrigger() {
  return triggerButton;
}

export function destroyTrigger() {
  if (triggerButton) {
    triggerButton.removeEventListener('click', handleClick);
    triggerButton.remove();
    triggerButton = null;
    onTriggerCallback = null;
  }
}

export function hideTrigger() {
  if (triggerButton) {
    triggerButton.style.display = 'none';
  }
}

export function showTrigger() {
  if (triggerButton) {
    triggerButton.style.display = 'flex';
  }
}
