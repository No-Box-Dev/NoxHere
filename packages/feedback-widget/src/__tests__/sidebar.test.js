import { describe, it, expect } from 'vitest';
import { truncate, escapeHtml, validateFormData, createSidebarHTML } from '../sidebar.js';

describe('truncate', () => {
  it('returns string as-is when shorter than limit', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('returns string as-is when exactly at limit', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });

  it('truncates and adds ellipsis when longer than limit', () => {
    expect(truncate('hello world', 5)).toBe('hello...');
  });

  it('handles empty string', () => {
    expect(truncate('', 5)).toBe('');
  });

  it('truncates long URLs', () => {
    const url = 'https://example.com/very/long/path/to/some/resource';
    const result = truncate(url, 20);
    expect(result).toBe('https://example.com/...');
    expect(result.length).toBe(23); // 20 + '...'
  });
});

describe('escapeHtml', () => {
  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes less than', () => {
    expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
  });

  it('escapes greater than', () => {
    expect(escapeHtml('a > b')).toBe('a &gt; b');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  it('escapes all special chars together', () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  });

  it('returns plain text unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('validateFormData', () => {
  const ok = { title: 'Bug', description: 'Steps', reporter: 'jasper' };

  it('passes on a valid payload', () => {
    expect(validateFormData(ok)).toEqual({});
  });

  it('flags missing title', () => {
    const errors = validateFormData({ ...ok, title: '' });
    expect(errors['noxspot-title']).toMatch(/required/i);
  });

  it('flags missing reporter', () => {
    const errors = validateFormData({ ...ok, reporter: '' });
    expect(errors['noxspot-reporter']).toBeTruthy();
  });

  it('flags title over 256 chars', () => {
    const errors = validateFormData({ ...ok, title: 'a'.repeat(257) });
    expect(errors['noxspot-title']).toMatch(/too long/i);
  });

  it('flags description over 10000 chars', () => {
    const errors = validateFormData({ ...ok, description: 'a'.repeat(10001) });
    expect(errors['noxspot-description']).toMatch(/too long/i);
  });

  it('allows empty description', () => {
    const errors = validateFormData({ ...ok, description: '' });
    expect(errors).toEqual({});
  });

  it('flags reporter over 100 chars', () => {
    const errors = validateFormData({ ...ok, reporter: 'a'.repeat(101) });
    expect(errors['noxspot-reporter']).toMatch(/too long/i);
  });

  it('does not require reporter when reporter block is not required', () => {
    const blocks = [
      { type: 'title' },
      { type: 'description' },
      { id: 'r', type: 'reporter', required: false },
    ];
    const errors = validateFormData({ title: 'Bug', description: '', reporter: '' }, blocks);
    expect(errors).toEqual({});
  });

  it('flags missing required custom_text block', () => {
    const blocks = [
      { type: 'title' },
      { id: 'q1', type: 'custom_text', required: true, label: 'Why?' },
    ];
    const errors = validateFormData({ title: 'Bug', blockValues: {} }, blocks);
    expect(errors['noxspot-block-q1']).toMatch(/required/i);
  });

  it('does not flag empty optional custom_text', () => {
    const blocks = [
      { type: 'title' },
      { id: 'q1', type: 'custom_text', required: false, label: 'Why?' },
    ];
    const errors = validateFormData({ title: 'Bug', blockValues: {} }, blocks);
    expect(errors).toEqual({});
  });

  it('flags custom_text over 10000 chars', () => {
    const blocks = [
      { type: 'title' },
      { id: 'q1', type: 'custom_text', required: false },
    ];
    const errors = validateFormData(
      { title: 'Bug', blockValues: { q1: 'a'.repeat(10001) } },
      blocks
    );
    expect(errors['noxspot-block-q1']).toMatch(/too long/i);
  });

  it('skips title validation when title block is absent', () => {
    const blocks = [
      { type: 'description' },
      { type: 'reporter', required: false },
    ];
    const errors = validateFormData({ title: '', description: '', reporter: '' }, blocks);
    expect(errors['noxspot-title']).toBeUndefined();
  });
});

describe('createSidebarHTML', () => {
  const ctx = { metadata: null, onSubmit: () => {}, members: [], categories: [] };

  it('renders only the blocks it is given', () => {
    const html = createSidebarHTML({
      ...ctx,
      blocks: [{ type: 'title' }, { type: 'description' }],
    });
    expect(html).toContain('id="noxspot-title"');
    expect(html).toContain('id="noxspot-description"');
    expect(html).not.toContain('id="noxspot-reporter"');
    expect(html).not.toContain('noxspot-elements-section');
    expect(html).not.toContain('noxspot-form-group--metadata');
  });

  it('renders custom_text input with the block id and label', () => {
    const html = createSidebarHTML({
      ...ctx,
      blocks: [
        { type: 'title' },
        { id: 'why', type: 'custom_text', label: 'What were you trying to do?', required: true },
      ],
    });
    expect(html).toContain('id="noxspot-block-why"');
    expect(html).toContain('What were you trying to do?');
    expect(html).toContain('data-block-id="why"');
    expect(html).toContain('data-block-type="custom_text"');
    expect(html).toContain('required');
  });

  it('renders custom_textarea with rows attribute', () => {
    const html = createSidebarHTML({
      ...ctx,
      blocks: [{ id: 'notes', type: 'custom_textarea', label: 'Notes' }],
    });
    expect(html).toContain('id="noxspot-block-notes"');
    expect(html).toContain('<textarea');
    expect(html).toContain('rows="3"');
  });

  it('renders custom_select options', () => {
    const html = createSidebarHTML({
      ...ctx,
      blocks: [{ id: 'sev', type: 'custom_select', label: 'Severity', options: ['Low', 'High'] }],
    });
    expect(html).toContain('id="noxspot-block-sev"');
    expect(html).toContain('<option value="Low">Low</option>');
    expect(html).toContain('<option value="High">High</option>');
  });

  it('escapes custom_select option values', () => {
    const html = createSidebarHTML({
      ...ctx,
      blocks: [{ id: 'x', type: 'custom_select', options: ['<script>'] }],
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('omits Selected Elements section when no element_picker block is present', () => {
    const html = createSidebarHTML({
      ...ctx,
      blocks: [{ type: 'title' }],
    });
    expect(html).not.toContain('noxspot-elements-section');
    expect(html).not.toContain('Selected Elements');
  });

  it('renders Selected Elements section when element_picker block is present', () => {
    const html = createSidebarHTML({
      ...ctx,
      blocks: [{ type: 'title' }, { type: 'element_picker' }],
    });
    expect(html).toContain('noxspot-elements-section');
  });

  it('omits Captured Info section when metadata block is present but metadata is null', () => {
    const html = createSidebarHTML({
      ...ctx,
      blocks: [{ type: 'title' }, { type: 'metadata' }],
    });
    expect(html).not.toContain('Captured Info');
  });

  it('renders Captured Info when metadata block + metadata cache both present', () => {
    const html = createSidebarHTML({
      ...ctx,
      metadata: { url: 'https://x', browser: 'Chrome', os: 'macOS', viewport: '100x100' },
      blocks: [{ type: 'title' }, { type: 'metadata' }],
    });
    expect(html).toContain('Captured Info');
    expect(html).toContain('Chrome');
  });

  it('console_logs block produces no sidebar markup', () => {
    const html = createSidebarHTML({
      ...ctx,
      blocks: [{ type: 'title' }, { type: 'console_logs' }],
    });
    expect(html).not.toMatch(/console/i);
  });

  it('renders category dropdown when 2+ categories present', () => {
    const html = createSidebarHTML({
      ...ctx,
      categories: [{ label: 'Bug' }, { label: 'Feedback' }],
      blocks: [{ type: 'title' }, { type: 'category' }],
    });
    expect(html).toContain('id="noxspot-category"');
    expect(html).toContain('Bug');
    expect(html).toContain('Feedback');
  });

  it('omits category dropdown with fewer than 2 categories', () => {
    const html = createSidebarHTML({
      ...ctx,
      categories: [{ label: 'Bug' }],
      blocks: [{ type: 'title' }, { type: 'category' }],
    });
    expect(html).not.toContain('id="noxspot-category"');
  });

  it('falls back to a default block list when blocks is missing or empty', () => {
    // Covers the case where an OLD cached loader passes no `blocks` into
    // the NEW core's overlay — without a fallback, the user would see an
    // empty form.
    const fromUndefined = createSidebarHTML({ ...ctx, blocks: undefined });
    expect(fromUndefined).toContain('id="noxspot-title"');
    expect(fromUndefined).toContain('id="noxspot-description"');
    expect(fromUndefined).toContain('id="noxspot-reporter"');

    const fromEmpty = createSidebarHTML({ ...ctx, blocks: [] });
    expect(fromEmpty).toContain('id="noxspot-title"');
  });

  it('strips non-safe characters from custom block ids before using them in HTML', () => {
    // Defense-in-depth: the API generates 32-char hex but the widget runs
    // on customer pages and must not trust server-supplied strings as raw
    // HTML attribute values. Verifying via DOM parse so escaped occurrences
    // inside attribute values don't false-positive a raw-substring check.
    const html = createSidebarHTML({
      ...ctx,
      blocks: [{ id: 'x" onmouseover="alert(1)', type: 'custom_text', label: 'Q' }],
    });
    const container = document.createElement('div');
    container.innerHTML = html;
    const input = container.querySelector('input.noxspot-input');
    expect(input).not.toBeNull();
    // The dangerous chars must be stripped from the raw DOM id, not just
    // HTML-escaped — otherwise the value still ends up live on the element.
    // Sanitized form: lowercased, only [a-z0-9-] retained — quotes/spaces gone.
    expect(input.id).toBe('noxspot-block-xonmouseoveralert1');
    expect(input.hasAttribute('onmouseover')).toBe(false);
  });

  it('skips malformed block entries without crashing', () => {
    const html = createSidebarHTML({
      ...ctx,
      blocks: [null, { type: 'title' }, { /* no type */ }, { type: 'unknown_type' }],
    });
    expect(html).toContain('id="noxspot-title"');
  });
});
