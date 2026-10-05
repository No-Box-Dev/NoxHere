/**
 * Form sidebar for bug report submission.
 *
 * The form layout is driven by `blocks` — a list of block definitions
 * delivered by the server (api/src/routes/config.js). Each block names a
 * type (title, description, reporter, category, custom_text, ..., metadata,
 * console_logs, element_picker) and the renderer below maps it to its
 * sidebar markup. Blocks not in the list don't render and their values
 * aren't sent on submit.
 */

import { escapeHtml } from './utils.js';
import { debugLog } from './debug.js';

// Mirror server-side limits in api/src/lib/report.js validateReportInput
// so users see problems inline instead of submitting and getting a 400.
const TITLE_MAX = 256;
const DESCRIPTION_MAX = 10000;
const REPORTER_MAX = 100;
const CUSTOM_TEXT_MAX = 10000;

let onSubmitCallback = null;
let reporterMembers = [];
let reportCategories = [];
let formBlocks = [];

// Fallback used when the host page has an OLD cached loader.min.js but
// loaded the NEW core bundle — the old loader doesn't pass `blocks` into
// overlay options, so without this the sidebar would render an empty
// form. Mirrors loader.js DEFAULT_BLOCKS; kept duplicated to avoid a
// circular import between sidebar.js (core bundle) and loader.js
// (loader bundle).
const FALLBACK_BLOCKS = [
  { id: 'fallback-title', type: 'title', required: true },
  { id: 'fallback-description', type: 'description', required: true },
  { id: 'fallback-reporter', type: 'reporter', required: true },
  { id: 'fallback-category', type: 'category', required: false },
  { id: 'fallback-element-picker', type: 'element_picker', required: false },
  { id: 'fallback-metadata', type: 'metadata', required: false },
  { id: 'fallback-console-logs', type: 'console_logs', required: false },
];

// Hardcoded ids for the four "core" form fields keep the existing CSS,
// validation, and combobox event wiring intact.
const CORE_IDS = {
  title: 'noxspot-title',
  description: 'noxspot-description',
  reporter: 'noxspot-reporter',
  category: 'noxspot-category',
};

// Strip block IDs to a safe DOM-id charset before interpolating into HTML.
// The API generates IDs as 32-char hex, but the widget runs on customer
// pages and shouldn't trust server-supplied strings as raw HTML attribute
// values — a malformed id would otherwise break out of the attribute and
// inject markup. Anything outside [a-z0-9-] is dropped.
function customBlockDomId(blockId) {
  const safe = String(blockId || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  return `noxspot-block-${safe}`;
}

/**
 * Create the sidebar HTML content.
 * @param {Object} opts
 * @param {Array<Object>} opts.blocks - Block definitions from /config
 * @param {Object} opts.metadata - Auto-collected metadata
 * @param {Function} opts.onSubmit - Submit callback
 * @param {string} [opts.screenshotDataUrl] - Mobile thumbnail (optional, set later)
 * @param {Array<{login:string}>} [opts.members] - GitHub org members for reporter combobox
 * @param {Array<{label:string}>} [opts.categories] - Routing categories
 * @returns {string} HTML string
 */
export function createSidebarHTML(opts) {
  const { blocks, metadata, onSubmit, screenshotDataUrl, members, categories } = opts;
  onSubmitCallback = onSubmit;
  reporterMembers = Array.isArray(members) ? members : [];
  reportCategories = Array.isArray(categories) ? categories.filter(c => c && typeof c.label === 'string' && c.label) : [];
  formBlocks = Array.isArray(blocks) && blocks.length ? blocks : FALLBACK_BLOCKS;

  const thumbnailHTML = `
    <div class="noxspot-mobile-thumbnail" style="display:none">
      <img src="${screenshotDataUrl || ''}" alt="Screenshot preview" />
    </div>
  `;

  const blocksHTML = formBlocks.map((b) => renderBlock(b, metadata)).join('');

  return `
    <div class="noxspot-sidebar-content">
      ${thumbnailHTML}
      <div class="noxspot-sidebar-header" style="display: flex; align-items: center;">
        <button type="button" class="noxspot-mobile-back" style="display:none">&larr; Back</button>
        <h2 class="noxspot-sidebar-title">Report Issue</h2>
      </div>

      <form class="noxspot-form" id="noxspot-form">
        ${blocksHTML}

        <div class="noxspot-submit-row">
          <button type="submit" class="noxspot-submit-btn">
            Submit
          </button>
        </div>
      </form>
    </div>
  `;
}

function renderBlock(block, metadata) {
  if (!block || typeof block.type !== 'string') return '';
  switch (block.type) {
    case 'title':           return renderTitle(block);
    case 'description':     return renderDescription(block);
    case 'reporter':        return renderReporter(block);
    case 'category':        return renderCategory(block);
    case 'custom_text':     return renderCustomText(block);
    case 'custom_textarea': return renderCustomTextarea(block);
    case 'custom_select':   return renderCustomSelect(block);
    case 'element_picker':  return renderElementsSection();
    case 'metadata':        return renderMetadataSection(metadata);
    // console_logs has no sidebar UI — its presence only controls whether
    // captured logs ship in the submit body (handled by the loader).
    case 'console_logs':    return '';
    default:                return '';
  }
}

function renderTitle(block) {
  const labelText = block.label || 'Title';
  return `
    <div class="noxspot-form-group">
      <label class="noxspot-label" for="${CORE_IDS.title}">${escapeHtml(labelText)} <span class="noxspot-title-required">*</span></label>
      <input
        type="text"
        id="${CORE_IDS.title}"
        class="noxspot-input"
        placeholder="Brief description of the issue"
        maxlength="${TITLE_MAX}"
        required
      />
      <div class="noxspot-field-error" id="${CORE_IDS.title}-error" role="alert"></div>
    </div>
  `;
}

function renderDescription(block) {
  const labelText = block.label || 'Description';
  return `
    <div class="noxspot-form-group">
      <label class="noxspot-label" for="${CORE_IDS.description}">${escapeHtml(labelText)}</label>
      <textarea
        id="${CORE_IDS.description}"
        class="noxspot-textarea"
        placeholder="Steps to reproduce, expected behavior, etc."
        rows="4"
        maxlength="${DESCRIPTION_MAX}"
      ></textarea>
      <div class="noxspot-field-error" id="${CORE_IDS.description}-error" role="alert"></div>
    </div>
  `;
}

function renderReporter(block) {
  const labelText = block.label || 'Submitted by';
  const requiredMark = block.required ? ' *' : '';
  return `
    <div class="noxspot-form-group">
      <label class="noxspot-label" for="${CORE_IDS.reporter}">${escapeHtml(labelText)}${requiredMark}</label>
      <div class="noxspot-combobox">
        <input
          type="text"
          id="${CORE_IDS.reporter}"
          class="noxspot-input"
          placeholder="Your name or GitHub handle"
          autocomplete="off"
          spellcheck="false"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded="false"
          aria-controls="noxspot-reporter-menu"
          data-1p-ignore
          data-lpignore="true"
          maxlength="${REPORTER_MAX}"
          ${block.required ? 'required' : ''}
        />
        <div
          id="noxspot-reporter-menu"
          class="noxspot-dropdown-menu"
          role="listbox"
        ></div>
      </div>
      <div class="noxspot-field-error" id="${CORE_IDS.reporter}-error" role="alert"></div>
    </div>
  `;
}

function renderCategory(block) {
  // Dropdown only renders when 2+ categories are configured — a single
  // option offers no choice, and zero is a backend misconfig that
  // shouldn't break the form.
  if (reportCategories.length < 2) return '';
  const labelText = block.label || 'Category';
  return `
    <div class="noxspot-form-group">
      <label class="noxspot-label" for="${CORE_IDS.category}">${escapeHtml(labelText)}</label>
      <select id="${CORE_IDS.category}" class="noxspot-input">
        <option value="">— Select a category (optional) —</option>
        ${reportCategories.map(c => `<option value="${escapeHtml(c.label)}">${escapeHtml(c.label)}</option>`).join('')}
      </select>
    </div>
  `;
}

function renderCustomText(block) {
  const id = customBlockDomId(block.id);
  const labelText = block.label || 'Answer';
  const requiredMark = block.required ? ' <span class="noxspot-title-required">*</span>' : '';
  return `
    <div class="noxspot-form-group" data-block-id="${escapeHtml(block.id)}" data-block-type="custom_text">
      <label class="noxspot-label" for="${id}">${escapeHtml(labelText)}${requiredMark}</label>
      <input
        type="text"
        id="${id}"
        class="noxspot-input"
        maxlength="${CUSTOM_TEXT_MAX}"
        ${block.required ? 'required' : ''}
      />
      <div class="noxspot-field-error" id="${id}-error" role="alert"></div>
    </div>
  `;
}

function renderCustomTextarea(block) {
  const id = customBlockDomId(block.id);
  const labelText = block.label || 'Answer';
  const requiredMark = block.required ? ' <span class="noxspot-title-required">*</span>' : '';
  return `
    <div class="noxspot-form-group" data-block-id="${escapeHtml(block.id)}" data-block-type="custom_textarea">
      <label class="noxspot-label" for="${id}">${escapeHtml(labelText)}${requiredMark}</label>
      <textarea
        id="${id}"
        class="noxspot-textarea"
        rows="3"
        maxlength="${CUSTOM_TEXT_MAX}"
        ${block.required ? 'required' : ''}
      ></textarea>
      <div class="noxspot-field-error" id="${id}-error" role="alert"></div>
    </div>
  `;
}

function renderCustomSelect(block) {
  const id = customBlockDomId(block.id);
  const labelText = block.label || 'Select';
  const requiredMark = block.required ? ' <span class="noxspot-title-required">*</span>' : '';
  const options = Array.isArray(block.options) ? block.options : [];
  return `
    <div class="noxspot-form-group" data-block-id="${escapeHtml(block.id)}" data-block-type="custom_select">
      <label class="noxspot-label" for="${id}">${escapeHtml(labelText)}${requiredMark}</label>
      <select id="${id}" class="noxspot-input" ${block.required ? 'required' : ''}>
        <option value="">— Select —</option>
        ${options.map((opt) => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`).join('')}
      </select>
      <div class="noxspot-field-error" id="${id}-error" role="alert"></div>
    </div>
  `;
}

function renderElementsSection() {
  return `
    <div class="noxspot-form-group noxspot-elements-section" style="display: none;">
      <label class="noxspot-label">Selected Elements</label>
      <div class="noxspot-elements-list"></div>
    </div>
  `;
}

function renderMetadataSection(metadata) {
  if (!metadata) return '';
  return `
    <div class="noxspot-form-group noxspot-form-group--metadata">
      <label class="noxspot-label">Captured Info</label>
      <div class="noxspot-metadata">
        <div class="noxspot-metadata-item">
          <span class="noxspot-metadata-label">URL</span>
          <span class="noxspot-metadata-value" title="${escapeHtml(metadata.url)}">${escapeHtml(truncate(metadata.url, 35))}</span>
        </div>
        <div class="noxspot-metadata-item">
          <span class="noxspot-metadata-label">Browser</span>
          <span class="noxspot-metadata-value">${escapeHtml(metadata.browser)}</span>
        </div>
        <div class="noxspot-metadata-item">
          <span class="noxspot-metadata-label">OS</span>
          <span class="noxspot-metadata-value">${escapeHtml(metadata.os)}</span>
        </div>
        <div class="noxspot-metadata-item">
          <span class="noxspot-metadata-label">Viewport</span>
          <span class="noxspot-metadata-value">${escapeHtml(metadata.viewport)}</span>
        </div>
      </div>
      <p class="noxspot-hint">Screenshot issues? Try disabling browser extensions.</p>
    </div>
  `;
}

/**
 * Initialize sidebar event listeners
 */
export function initSidebarEvents() {
  const form = document.getElementById('noxspot-form');
  if (form) {
    form.addEventListener('submit', handleSubmit);
  }
  initReporterCombobox();
  initFieldErrorClearing();
}

function initFieldErrorClearing() {
  const ids = [CORE_IDS.title, CORE_IDS.description, CORE_IDS.reporter];
  for (const block of formBlocks) {
    if (block.type === 'custom_text' || block.type === 'custom_textarea' || block.type === 'custom_select') {
      ids.push(customBlockDomId(block.id));
    }
  }
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.addEventListener('input', () => setFieldError(id, ''));
  }
}

function setFieldError(inputId, message) {
  const errorEl = document.getElementById(`${inputId}-error`);
  const inputEl = document.getElementById(inputId);
  if (errorEl) errorEl.textContent = message || '';
  if (inputEl) inputEl.classList.toggle('noxspot-input--invalid', !!message);
}

export function validateFormData(data, blocks) {
  const errors = {};
  // Default to legacy required fields when callers don't pass blocks
  // (back-compat with existing tests). The runtime always passes blocks.
  const blockList = Array.isArray(blocks) ? blocks : [
    { type: 'title' },
    { type: 'description' },
    { type: 'reporter', required: true },
  ];
  const has = (type) => blockList.some((b) => b.type === type);

  if (has('title')) {
    if (!data.title) errors[CORE_IDS.title] = 'Title is required.';
    else if (data.title.length > TITLE_MAX) errors[CORE_IDS.title] = `Title is too long (max ${TITLE_MAX} characters).`;
  }

  if (has('description')) {
    if (data.description && data.description.length > DESCRIPTION_MAX) {
      errors[CORE_IDS.description] = `Description is too long (max ${DESCRIPTION_MAX} characters).`;
    }
  }

  const reporterBlock = blockList.find((b) => b.type === 'reporter');
  if (reporterBlock) {
    if (reporterBlock.required && !data.reporter) {
      errors[CORE_IDS.reporter] = 'Please tell us who is submitting this.';
    } else if (data.reporter && data.reporter.length > REPORTER_MAX) {
      errors[CORE_IDS.reporter] = `Name is too long (max ${REPORTER_MAX} characters).`;
    }
  }

  for (const block of blockList) {
    if (block.type !== 'custom_text' && block.type !== 'custom_textarea' && block.type !== 'custom_select') continue;
    const id = customBlockDomId(block.id);
    const value = data.blockValues?.[block.id];
    if (block.required) {
      const empty = !value || (typeof value === 'string' && !value.trim());
      if (empty) errors[id] = 'This field is required.';
    }
    if (typeof value === 'string' && value.length > CUSTOM_TEXT_MAX) {
      errors[id] = `Too long (max ${CUSTOM_TEXT_MAX} characters).`;
    }
  }

  return errors;
}

function collectFormData() {
  const titleEl = document.getElementById(CORE_IDS.title);
  const descriptionEl = document.getElementById(CORE_IDS.description);
  const reporterEl = document.getElementById(CORE_IDS.reporter);
  const categoryEl = document.getElementById(CORE_IDS.category);

  const blockValues = {};
  for (const block of formBlocks) {
    if (block.type !== 'custom_text' && block.type !== 'custom_textarea' && block.type !== 'custom_select') continue;
    const el = document.getElementById(customBlockDomId(block.id));
    if (!el) continue;
    const v = el.value.trim();
    if (v) blockValues[block.id] = v;
  }

  return {
    title: titleEl ? titleEl.value.trim() : '',
    description: descriptionEl ? descriptionEl.value.trim() : '',
    reporter: reporterEl ? reporterEl.value.trim() : '',
    category: (categoryEl ? categoryEl.value.trim() : '') || null,
    blockValues: Object.keys(blockValues).length ? blockValues : null,
  };
}

function initReporterCombobox() {
  const input = document.getElementById(CORE_IDS.reporter);
  const menu = document.getElementById('noxspot-reporter-menu');
  if (!input || !menu) return;

  let highlightIndex = -1;
  let currentItems = [];

  function filter(query) {
    if (!reporterMembers.length) return [];
    const q = query.trim().toLowerCase().replace(/^@/, '');
    if (!q) return reporterMembers.slice();
    const starts = [];
    const contains = [];
    for (const m of reporterMembers) {
      const login = m.login.toLowerCase();
      if (login.startsWith(q)) starts.push(m);
      else if (login.includes(q)) contains.push(m);
    }
    return [...starts, ...contains];
  }

  function render(items) {
    currentItems = items;
    highlightIndex = -1;
    if (!reporterMembers.length) {
      menu.innerHTML = '';
      return;
    }
    if (!items.length) {
      menu.innerHTML = '<div class="noxspot-dropdown-empty">No matches — press Enter to use what you typed</div>';
      return;
    }
    menu.innerHTML = items.map((m, i) =>
      `<div class="noxspot-dropdown-item" role="option" data-index="${i}" data-login="${escapeHtml(m.login)}">@${escapeHtml(m.login)}</div>`
    ).join('');
    menu.querySelectorAll('.noxspot-dropdown-item').forEach((el) => {
      // mousedown (not click) so selection fires before blur hides the menu
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        input.value = el.dataset.login;
        closeMenu();
      });
      el.addEventListener('mouseenter', () => {
        highlightIndex = Number(el.dataset.index);
        paintHighlight();
      });
    });
  }

  function paintHighlight() {
    menu.querySelectorAll('.noxspot-dropdown-item').forEach((el, i) => {
      el.classList.toggle('highlighted', i === highlightIndex);
    });
    const active = menu.querySelector('.noxspot-dropdown-item.highlighted');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  function openMenu() {
    if (!reporterMembers.length) return;
    menu.classList.add('open');
    input.setAttribute('aria-expanded', 'true');
  }

  function closeMenu() {
    menu.classList.remove('open');
    input.setAttribute('aria-expanded', 'false');
    highlightIndex = -1;
  }

  input.addEventListener('focus', () => {
    render(filter(input.value));
    openMenu();
  });
  input.addEventListener('input', () => {
    render(filter(input.value));
    openMenu();
  });
  input.addEventListener('blur', () => {
    setTimeout(closeMenu, 150);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      openMenu();
      if (!currentItems.length) return;
      highlightIndex = (highlightIndex + 1) % currentItems.length;
      paintHighlight();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!currentItems.length) return;
      highlightIndex = highlightIndex <= 0 ? currentItems.length - 1 : highlightIndex - 1;
      paintHighlight();
    } else if (e.key === 'Enter') {
      if (highlightIndex >= 0 && currentItems[highlightIndex]) {
        e.preventDefault();
        input.value = currentItems[highlightIndex].login;
        closeMenu();
      }
    } else if (e.key === 'Escape') {
      if (menu.classList.contains('open')) {
        e.preventDefault();
        e.stopPropagation();
        closeMenu();
      }
    }
  });
}

function handleSubmit(e) {
  e.preventDefault();
  const data = collectFormData();

  // Clear previous errors on every input we know about
  const ids = [CORE_IDS.title, CORE_IDS.description, CORE_IDS.reporter];
  for (const block of formBlocks) {
    if (block.type === 'custom_text' || block.type === 'custom_textarea' || block.type === 'custom_select') {
      ids.push(customBlockDomId(block.id));
    }
  }
  for (const id of ids) setFieldError(id, '');

  const errors = validateFormData(data, formBlocks);
  const errorIds = Object.keys(errors);
  if (errorIds.length > 0) {
    for (const id of errorIds) setFieldError(id, errors[id]);
    const firstInvalid = document.getElementById(errorIds[0]);
    if (firstInvalid) firstInvalid.focus();
    return;
  }
  debugLog('[NoxSpot] Form submitted', data);
  if (onSubmitCallback) onSubmitCallback(data);
}

export function truncate(str, length) {
  if (str == null) return '';
  str = String(str);
  if (str.length <= length) return str;
  return str.substring(0, length) + '...';
}

// Re-export for other modules
export { escapeHtml };

/**
 * Update the selected elements display in the sidebar
 * @param {Array} elements - Array of element info objects
 * @param {Function} onRemove - Callback when element is removed, receives index
 */
export function updateSelectedElements(elements, onRemove) {
  const section = document.querySelector('.noxspot-elements-section');
  const list = document.querySelector('.noxspot-elements-list');

  if (!section || !list) return;

  if (elements.length === 0) {
    section.style.display = 'none';
    list.innerHTML = '';
    return;
  }

  section.style.display = 'block';
  list.innerHTML = elements.map((el, index) => {
    // Merge own data attrs + ancestor data attrs for this element
    const attrs = {};
    if (el.dataAttributes) {
      for (const [k, v] of Object.entries(el.dataAttributes)) {
        const key = k.replace(/^data-/, '');
        attrs[key] = v;
      }
    }
    if (el.ancestorData) {
      for (const [k, v] of Object.entries(el.ancestorData)) {
        const key = k.replace(/^data-/, '');
        if (!(key in attrs)) attrs[key] = v;
      }
    }

    // Deduplicate by value — if row-id and record-id have the same value, keep the first
    const seenValues = new Set();
    const dedupedKeys = [];
    for (const k of Object.keys(attrs)) {
      if (!seenValues.has(attrs[k])) {
        seenValues.add(attrs[k]);
        dedupedKeys.push(k);
      }
    }

    const attrList = dedupedKeys.length > 0 ? `
      <div class="noxspot-element-attrs">
        ${dedupedKeys.map(k => `<span class="noxspot-attr-pill"><span class="noxspot-attr-key">${escapeHtml(k)}</span> ${escapeHtml(attrs[k])}</span>`).join('')}
      </div>
    ` : '';

    return `
      <div class="noxspot-element-chip" data-index="${index}">
        <div class="noxspot-element-row">
          <span class="noxspot-element-tag">${escapeHtml(el.tagName)}</span>
          <span class="noxspot-element-detail">${escapeHtml(getElementLabel(el))}</span>
          <button type="button" class="noxspot-element-remove" data-index="${index}" aria-label="Remove">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        ${attrList}
      </div>
    `;
  }).join('');

  // Add remove handlers
  list.querySelectorAll('.noxspot-element-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const index = parseInt(btn.dataset.index, 10);
      if (onRemove) onRemove(index);
    });
  });

}

function getElementLabel(el) {
  let label = '';

  // Primary identifier
  if (el.id) {
    label = `#${el.id}`;
  } else if (el.classes && el.classes.length > 0) {
    label = `.${el.classes[0]}`;
  }

  // Add text context
  if (el.text && el.text.length > 0) {
    const textPreview = truncate(el.text, 25);
    label += label ? ` "${textPreview}"` : `"${textPreview}"`;
  } else if (el.innerText && el.innerText.length > 0) {
    const textPreview = truncate(el.innerText, 25);
    label += label ? ` "${textPreview}"` : `"${textPreview}"`;
  }

  return label || el.selector || el.tagName;
}
