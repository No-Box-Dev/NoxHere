/**
 * In-house DOM-to-image rasterizer using SVG foreignObject.
 *
 * Clones the body, inlines getComputedStyle into inline styles, embeds
 * <img> sources as data URLs, wraps the tree in a <foreignObject>, and
 * paints the serialized SVG onto a canvas via drawImage. Zero runtime
 * dependencies. Replaces html2canvas-pro + html-to-image.
 */

import { debugLog } from './debug.js';

const XHTML_NS = 'http://www.w3.org/1999/xhtml';
const SVG_NS = 'http://www.w3.org/2000/svg';

const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'LINK', 'META', 'TITLE', 'NOSCRIPT', 'TEMPLATE',
  // IFRAME is intentionally not skipped — cloneNode has a dedicated branch
  // that walks same-origin iframe contents and renders a labelled
  // placeholder for cross-origin ones, so the screenshot doesn't show a
  // blank rectangle where an iframe was.
  'CANVAS', 'OBJECT', 'EMBED',
  // <source> children of <picture>/<video>/<audio> carry srcset URLs the UA
  // re-resolves at render time. The <img> inside <picture> still has the
  // browser-resolved currentSrc, so dropping <source> loses nothing and
  // prevents a srcset URL from sneaking back into the clone.
  'SOURCE', 'TRACK',
  // Cross-origin poster/src attributes on these can taint. We can't
  // screenshot a playing video anyway.
  'VIDEO', 'AUDIO',
]);

// backdrop-filter silently fails to paint inside foreignObject — the scrim
// renders transparent. Skipping the property lets the rgba() background
// that almost always accompanies it render instead.
const SKIP_STYLE_PROPS = new Set([
  'backdrop-filter', '-webkit-backdrop-filter',
]);

const IMAGE_FETCH_TIMEOUT_MS = 3000;
const RASTERIZE_TIMEOUT_MS = 10_000;

/**
 * Capture the current viewport as a PNG data URL.
 *
 * @param {Object} [options]
 * @param {(node: Element) => boolean} [options.filter] - Return false to skip
 * @param {string} [options.backgroundColor] - Canvas fill under the snapshot
 * @returns {Promise<{ dataUrl: string, viewport: { width: number, height: number } }>}
 */
export async function captureViewport(options = {}) {
  const filter = options.filter || (() => true);
  const width = document.documentElement.clientWidth;
  const height = document.documentElement.clientHeight;
  const background = options.backgroundColor || resolveBackground();

  const pairs = [];
  const bodyClone = cloneNode(document.body, filter, pairs);
  if (!bodyClone) throw new Error('Body node rejected by filter');

  for (const [source, clone] of pairs) {
    flattenComputedStyle(source, clone);
    preserveFormState(source, clone);
  }

  // Inner-container scroll: cloneNode doesn't carry scrollTop/scrollLeft,
  // so without this the screenshot shows the top of every scroll container
  // instead of where the user's scrolled to. The wrapper transform below
  // handles window scroll on body-scroll pages — here we cover the SPA
  // pattern (height:100vh; overflow:auto on a child) where window.scrollY
  // is 0. Done in a second pass: doing it inline above would have the
  // iterator reach the scrolled element's children next and overwrite
  // their transforms via flattenComputedStyle.
  for (const [source, clone] of pairs) {
    applyScrollOffset(source, clone);
  }

  // Offset the clone by current scroll position so foreignObject renders the
  // visible viewport, not the top of the page.
  const wrapper = document.createElementNS(XHTML_NS, 'div');
  wrapper.setAttribute('xmlns', XHTML_NS);
  wrapper.style.cssText = [
    'margin:0',
    'padding:0',
    `transform:translate(${-window.scrollX}px, ${-window.scrollY}px)`,
    'transform-origin:top left',
    'width:100%',
    'height:100%',
  ].join(';');
  wrapper.appendChild(bodyClone);

  const [, fontCss] = await Promise.all([
    inlineExternalResources(pairs),
    collectInlinedFontCss(),
  ]);
  // Web fonts: foreignObject inherits the page's @font-face *bindings* but
  // the SVG renderer fetches the underlying font files in an isolated
  // context that doesn't carry the page's CORS context, so most cross-origin
  // fonts fail to load and the renderer falls back to a generic system
  // font. Inlining the @font-face rules with data-URL src refs avoids the
  // fallback. Inject before the audit so any url() refs we couldn't resolve
  // are visible there too.
  if (fontCss) {
    const styleEl = document.createElementNS(XHTML_NS, 'style');
    styleEl.textContent = fontCss;
    wrapper.insertBefore(styleEl, wrapper.firstChild);
  }
  // Always audit — if anything made it through, console.warn so customers
  // can diagnose taint failures without toggling debug mode.
  auditRemainingExternalUrls(wrapper);

  const svgString = buildSvg(wrapper, width, height);
  const dataUrl = await rasterizeSvg(svgString, width, height, background);

  debugLog('[NoxSpot] Rasterize captured', {
    width,
    height,
    nodes: pairs.length,
    size: Math.round(dataUrl.length / 1024) + 'kb',
  });

  return { dataUrl, viewport: { width, height } };
}

function resolveBackground() {
  const bodyBg = window.getComputedStyle(document.body).backgroundColor;
  if (bodyBg && bodyBg !== 'rgba(0, 0, 0, 0)') return bodyBg;
  const htmlBg = window.getComputedStyle(document.documentElement).backgroundColor;
  if (htmlBg && htmlBg !== 'rgba(0, 0, 0, 0)') return htmlBg;
  debugLog('[NoxSpot] No background on html/body, falling back to #ffffff');
  return '#ffffff';
}

function cloneNode(source, filter, pairs) {
  if (!source) return null;

  if (source.nodeType === Node.TEXT_NODE) return source.cloneNode(false);
  if (source.nodeType !== Node.ELEMENT_NODE) return null;
  // tagName is uppercase for HTML and lowercase for SVG/MathML — uppercase
  // before lookup so `<svg><style>...` and `<svg><script>...` get skipped
  // too. Without this, an SVG <style> with cross-origin url() refs survives
  // the clone and taints the canvas at toDataURL.
  const tag = source.tagName.toUpperCase();
  if (SKIP_TAGS.has(tag)) return null;
  if (!filter(source)) return null;

  // Iframes can't be painted into foreignObject directly — browsers render
  // them as blank for cross-origin protection, even when same-origin.
  // cloneIframe inlines same-origin contents into a sized div so the
  // screenshot includes them, and renders a placeholder for cross-origin.
  if (tag === 'IFRAME') return cloneIframe(source, filter, pairs);

  const clone = source.cloneNode(false);
  pairs.push([source, clone]);

  for (const child of source.childNodes) {
    const childClone = cloneNode(child, filter, pairs);
    if (childClone) clone.appendChild(childClone);
  }
  return clone;
}

function cloneIframe(iframe, filter, pairs) {
  const rect = iframe.getBoundingClientRect();
  const wrapper = document.createElementNS(XHTML_NS, 'div');
  wrapper.setAttribute('xmlns', XHTML_NS);
  // Inline the iframe's own computed styles so positioned iframes
  // (position:absolute/fixed, margins, transforms) keep their place in
  // the layout. Done inline here — not via pairs — because the wrapper
  // is a div, and we don't want the outer flatten loop touching it
  // afterwards. The container overrides below then re-assert the box
  // model bits we need (display, sizing, clipping).
  flattenComputedStyle(iframe, wrapper);
  wrapper.style.setProperty('display', 'inline-block');
  wrapper.style.setProperty('width', `${rect.width}px`);
  wrapper.style.setProperty('height', `${rect.height}px`);
  wrapper.style.setProperty('overflow', 'hidden');
  wrapper.style.setProperty('vertical-align', 'top');
  wrapper.style.setProperty('box-sizing', 'border-box');
  wrapper.style.setProperty('padding', '0');

  // contentDocument throws SecurityError on cross-origin access; treat any
  // failure as "can't reach", and fall through to the placeholder branch.
  let innerDoc = null;
  try { innerDoc = iframe.contentDocument; } catch { innerDoc = null; }

  if (!innerDoc || !innerDoc.body) {
    const label = document.createElementNS(XHTML_NS, 'div');
    let host = '';
    try { host = new URL(iframe.src, window.location.href).host; } catch { /* unparseable src */ }
    label.style.cssText = [
      'width:100%',
      'height:100%',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'background:#f3f4f6',
      'color:#6b7280',
      'font:12px system-ui,sans-serif',
      'text-align:center',
      'padding:8px',
      'box-sizing:border-box',
    ].join(';');
    label.textContent = host ? `Cross-origin iframe (${host})` : 'Cross-origin iframe';
    wrapper.appendChild(label);
    return wrapper;
  }

  // Same-origin: clone the inner body. The recursive cloneNode call pushes
  // pairs into the same array, so the captureViewport flatten loop later
  // copies computed styles for everything inside the iframe too.
  const bodyClone = cloneNode(innerDoc.body, filter, pairs);
  if (!bodyClone) return wrapper;

  // Translate by the iframe's inner scroll position so the visible region
  // (not the top of the inner document) ends up inside the wrapper. Holding
  // the transform on bodyClone directly would be clobbered by the outer
  // flatten loop — innerDoc.body is in `pairs`, so flattenComputedStyle
  // would later overwrite the transform with the body's computed value
  // (usually "none"). An intermediate div sidesteps that: it isn't in
  // `pairs`, so its inline transform survives.
  const docEl = innerDoc.documentElement;
  const scrollX = (docEl && docEl.scrollLeft) || innerDoc.body.scrollLeft || 0;
  const scrollY = (docEl && docEl.scrollTop) || innerDoc.body.scrollTop || 0;
  if (scrollX || scrollY) {
    const scrollWrapper = document.createElementNS(XHTML_NS, 'div');
    scrollWrapper.style.cssText = [
      `transform:translate(${-scrollX}px, ${-scrollY}px)`,
      'transform-origin:top left',
      'width:100%',
      'height:100%',
    ].join(';');
    scrollWrapper.appendChild(bodyClone);
    wrapper.appendChild(scrollWrapper);
  } else {
    wrapper.appendChild(bodyClone);
  }
  return wrapper;
}

function applyScrollOffset(source, clone) {
  if (!source || source.nodeType !== Node.ELEMENT_NODE) return;
  // Window scroll on the root document is handled by the outer wrapper
  // transform; cloneIframe handles iframe-inner body scroll. Skip both
  // levels of root scrollers to avoid double-shifting.
  const tag = source.tagName;
  if (tag === 'BODY' || tag === 'HTML') return;
  const scrollX = source.scrollLeft || 0;
  const scrollY = source.scrollTop || 0;
  if (!scrollX && !scrollY) return;
  const offset = `translate(${-scrollX}px, ${-scrollY}px)`;
  for (const child of clone.childNodes) {
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const existing = child.style.transform;
    child.style.transform = existing && existing !== 'none' ? `${offset} ${existing}` : offset;
    if (!child.style.transformOrigin) child.style.transformOrigin = 'top left';
  }
}

function flattenComputedStyle(source, clone) {
  const computed = window.getComputedStyle(source);
  for (let i = 0; i < computed.length; i++) {
    const prop = computed[i];
    if (SKIP_STYLE_PROPS.has(prop)) continue;
    const value = computed.getPropertyValue(prop);
    if (value === '') continue;
    // setProperty handles escaping for values containing quotes (e.g.
    // font-family: "Open Sans"), which breaks string-concat serialization.
    clone.style.setProperty(prop, value, computed.getPropertyPriority(prop));
  }
}

function preserveFormState(source, clone) {
  const tag = source.tagName;
  if (tag === 'INPUT') {
    const type = (source.type || '').toLowerCase();
    if (type === 'password' || type === 'hidden') {
      clone.setAttribute('value', '');
      return;
    }
    if (type === 'checkbox' || type === 'radio') {
      if (source.checked) clone.setAttribute('checked', '');
      else clone.removeAttribute('checked');
      return;
    }
    clone.setAttribute('value', source.value || '');
  } else if (tag === 'TEXTAREA') {
    // Current value isn't reflected in the `value` attribute — write it as
    // text content so the clone renders what the user actually typed.
    clone.textContent = source.value || '';
  } else if (tag === 'SELECT') {
    const srcOpts = source.querySelectorAll('option');
    const cloneOpts = clone.querySelectorAll('option');
    cloneOpts.forEach((opt, i) => {
      if (srcOpts[i] && srcOpts[i].selected) opt.setAttribute('selected', '');
      else opt.removeAttribute('selected');
    });
  }
}

// CSS properties that can reference external URLs via url(...). Any of these
// left pointing at a cross-origin host without CORS headers will taint the
// rasterizer canvas and break toDataURL.
const CSS_URL_PROPS = [
  'background-image',
  'mask-image',
  '-webkit-mask-image',
  'border-image-source',
  'list-style-image',
  'cursor',
  'content',
  'filter',
  '-webkit-filter',
  'clip-path',
  'shape-outside',
  'mask',
  '-webkit-mask',
  'mask-border-source',
];

// Captures the inner URL of a CSS url(...) token in either quoted or unquoted
// form. Not a full parser — URLs containing literal ) or matching quote chars
// will fail to match, and those references simply won't be rewritten (the UA
// will still try to load them). Good enough for every real-world case we've
// seen.
const CSS_URL_REGEX = /url\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^)"']+))\s*\)/g;

// Attributes on various element types that can carry an external URL and
// taint the canvas when the SVG renderer resolves them.
const IMAGE_ATTRS_TO_STRIP = ['srcset', 'sizes'];

function isInlinable(url) {
  if (!url) return false;
  if (url.startsWith('data:')) return false;
  // Fragment refs (url(#id), href="#id") resolve inside the document, not
  // the isolated foreignObject, so they'd never render anyway. Fetching them
  // would pull the HTML page.
  if (url.startsWith('#')) return false;
  return true;
}

function getImageSource(source) {
  // currentSrc is the URL the browser actually resolved from srcset/picture.
  // Falls back to src for plain <img> and for elements where currentSrc
  // isn't populated (input type=image, SVG image).
  return (
    source.currentSrc ||
    source.getAttribute('src') ||
    source.getAttribute('href') ||
    source.getAttribute('xlink:href') ||
    ''
  );
}

async function inlineExternalResources(pairs) {
  const imgJobs = [];
  const svgImageJobs = [];
  const svgUseJobs = [];
  const styleJobs = [];
  const urls = new Set();

  for (const [source, clone] of pairs) {
    const tag = source.tagName;
    const isSvgNs = source.namespaceURI === SVG_NS;

    if (tag === 'IMG' || (tag === 'INPUT' && (source.type || '').toLowerCase() === 'image')) {
      const src = getImageSource(source);
      if (isInlinable(src)) urls.add(src);
      imgJobs.push({ clone, src });
    } else if (isSvgNs && (source.localName === 'image' || source.localName === 'feImage')) {
      // <svg image> and <feImage> both load external raster data into the
      // render tree via href/xlink:href — same taint vector, handle together.
      const href = getImageSource(source);
      if (isInlinable(href)) urls.add(href);
      svgImageJobs.push({ clone, href });
    } else if (isSvgNs && (source.localName === 'use' ||
                            source.localName === 'pattern' ||
                            source.localName === 'textPath')) {
      // <use>/<pattern>/<textPath href="#id"> referring to an in-document
      // symbol is fine and must be preserved — only strip when the href points
      // to an external URL, since cross-origin sprite sheets taint the canvas.
      const href = getImageSource(source);
      if (isInlinable(href)) svgUseJobs.push({ clone });
    }

    if (clone.style) {
      for (const prop of CSS_URL_PROPS) {
        const value = clone.style.getPropertyValue(prop);
        if (!value) continue;
        const propUrls = extractCssUrls(value).filter(isInlinable);
        if (propUrls.length) {
          propUrls.forEach((url) => urls.add(url));
          styleJobs.push({ clone, prop });
        }
      }
    }
  }

  // Fetch every unique URL once. Map value: data URL on success, null on
  // failure — null means "strip the reference" so the SVG renderer never
  // attempts a cross-origin load that would taint the canvas.
  const urlMap = new Map();
  await Promise.all([...urls].map(async (url) => {
    urlMap.set(url, await fetchAsDataUrl(url));
  }));

  let inlined = 0;
  let dropped = 0;

  for (const { clone, src } of imgJobs) {
    // Always strip srcset/sizes even when src inlined successfully — otherwise
    // the browser re-resolves srcset at render time, overriding our data URL.
    IMAGE_ATTRS_TO_STRIP.forEach((attr) => clone.removeAttribute(attr));
    if (!isInlinable(src)) continue;
    const dataUrl = urlMap.get(src);
    if (dataUrl) {
      clone.setAttribute('src', dataUrl);
      inlined++;
    } else {
      clone.removeAttribute('src');
      dropped++;
    }
  }

  for (const { clone, href } of svgImageJobs) {
    if (!isInlinable(href)) continue;
    const dataUrl = urlMap.get(href);
    if (dataUrl) {
      clone.setAttribute('href', dataUrl);
      clone.removeAttribute('xlink:href');
      inlined++;
    } else {
      clone.removeAttribute('href');
      clone.removeAttribute('xlink:href');
      dropped++;
    }
  }

  for (const { clone } of svgUseJobs) {
    clone.removeAttribute('href');
    clone.removeAttribute('xlink:href');
    dropped++;
  }

  for (const { clone, prop } of styleJobs) {
    const value = clone.style.getPropertyValue(prop);
    const rewritten = rewriteCssUrls(value, urlMap, (ok) => {
      if (ok) inlined++;
      else dropped++;
    });
    if (rewritten !== value) {
      clone.style.setProperty(prop, rewritten, clone.style.getPropertyPriority(prop));
    }
  }

  debugLog('[NoxSpot] External resources resolved', { inlined, dropped, unique: urls.size });
}

// Block-comment regex tolerant of nested url(...) parens; spans the whole
// @font-face declaration including its body braces. Greedy on the body is
// fine because @font-face bodies don't contain nested {} blocks.
const FONT_FACE_REGEX = /@font-face\s*\{[^}]*\}/gi;

// Walks document.styleSheets and returns a CSS string of @font-face rules
// with every url() reference rewritten to a data URL. The SVG renderer
// inside foreignObject doesn't inherit the page's font fetches, so without
// this pass any web-font glyphs render with a generic system fallback.
// Cross-origin stylesheets refuse cssRules access, so we refetch the sheet
// over HTTP and regex out the @font-face blocks as a fallback.
async function collectInlinedFontCss() {
  // Each entry: { cssText, baseUrl } — baseUrl is what relative font src
  // refs inside cssText resolve against (the sheet href when known, the
  // document base otherwise).
  const blocks = [];

  await Promise.all(Array.from(document.styleSheets).map(async (sheet) => {
    const baseUrl = sheet.href || document.baseURI;
    let rules = null;
    try { rules = sheet.cssRules; } catch { rules = null; }

    if (rules) {
      for (const rule of Array.from(rules)) {
        // Constructor-name check is broader than CSSRule.FONT_FACE_RULE and
        // works in jsdom too (where the numeric type constants vary).
        if (rule.constructor && rule.constructor.name === 'CSSFontFaceRule') {
          blocks.push({ cssText: rule.cssText, baseUrl });
        }
      }
    } else if (sheet.href) {
      try {
        const response = await fetch(sheet.href, { mode: 'cors', credentials: 'omit' });
        if (response.ok) {
          const text = await response.text();
          const matches = text.match(FONT_FACE_REGEX) || [];
          for (const cssText of matches) blocks.push({ cssText, baseUrl: sheet.href });
        }
      } catch { /* unfetchable sheet — skip */ }
    }
  }));

  if (!blocks.length) return '';

  // Resolve every font URL against its originating stylesheet, dedupe, then
  // fetch in parallel.
  const resolved = new Set();
  for (const { cssText, baseUrl } of blocks) {
    for (const raw of extractCssUrls(cssText)) {
      if (!isInlinable(raw)) continue;
      try { resolved.add(new URL(raw, baseUrl).href); } catch { /* unparseable */ }
    }
  }
  const urlMap = new Map();
  await Promise.all([...resolved].map(async (url) => {
    urlMap.set(url, await fetchAsDataUrl(url));
  }));

  // Rewrite each block, replacing url(...) with the data URL when fetched.
  // Failed fetches are left as-is — the SVG renderer will then fail to load
  // the font and fall back to the next src in the rule's src list (or to a
  // system font). That's the same behavior we had before the inlining pass,
  // so leaving the original URL is no worse than dropping it.
  const out = blocks.map(({ cssText, baseUrl }) => cssText.replace(
    CSS_URL_REGEX,
    (original, doubleQuoted, singleQuoted, unquoted) => {
      const raw = doubleQuoted || singleQuoted || unquoted;
      if (!isInlinable(raw)) return original;
      let absolute;
      try { absolute = new URL(raw, baseUrl).href; } catch { return original; }
      const dataUrl = urlMap.get(absolute);
      return dataUrl ? `url("${dataUrl}")` : original;
    },
  ));

  debugLog('[NoxSpot] Font-face inlined', {
    rules: blocks.length,
    fonts: resolved.size,
    succeeded: [...urlMap.values()].filter(Boolean).length,
  });

  return out.join('\n');
}

// Walks the clone right before serialization and logs anything left that
// could taint the canvas. Purely diagnostic — a clean capture should log
// an empty list. Helps triage customer sites where a taint source slipped
// past the inline pass.
function auditRemainingExternalUrls(root) {
  const remaining = [];

  // Any element carrying one of these attrs with an inlinable URL is a
  // candidate taint source when the SVG renderer resolves it. `poster` and
  // `data` are kept for forward-compat — <video>/<object> are in SKIP_TAGS
  // today, but the audit should still flag them if those tags are ever
  // unskipped or the attributes appear on unexpected elements.
  const URL_ATTRS = ['src', 'srcset', 'href', 'xlink:href', 'poster', 'data'];
  // Narrow the scan to elements that actually carry one of the audited attrs
  // — a targeted selector avoids the O(N·M) walk over every node.
  const candidates = root.querySelectorAll(
    '[src], [srcset], [href], [xlink\\:href], [poster], [data]',
  );
  const all = [root, ...candidates];
  for (const element of all) {
    for (const attr of URL_ATTRS) {
      const value = element.getAttribute(attr);
      if (value && isInlinable(value)) {
        remaining.push({ tag: element.tagName, attr, value: value.slice(0, 200) });
      }
    }
  }

  const styled = [root, ...root.querySelectorAll('[style]')];
  for (const element of styled) {
    if (!element.style) continue;
    for (const prop of CSS_URL_PROPS) {
      const value = element.style.getPropertyValue(prop);
      if (!value) continue;
      for (const url of extractCssUrls(value)) {
        if (isInlinable(url)) {
          remaining.push({ tag: element.tagName, prop, value: url.slice(0, 200) });
        }
      }
    }
  }

  if (remaining.length) {
    // Unconditional warn — this is the signal customers need to diagnose
    // canvas taint failures. Safe by design: only fires when the inline pass
    // left something behind, and we only surface the attribute/property and
    // a truncated URL (not page content).
    console.warn(
      '[NoxSpot] Rasterizer: external URLs still present pre-rasterize (likely to taint canvas)',
      remaining,
    );
  }
}

function extractCssUrls(cssValue) {
  const urls = [];
  CSS_URL_REGEX.lastIndex = 0;
  let match;
  while ((match = CSS_URL_REGEX.exec(cssValue)) !== null) {
    urls.push(match[1] || match[2] || match[3]);
  }
  return urls;
}

function rewriteCssUrls(cssValue, urlMap, onResolve) {
  CSS_URL_REGEX.lastIndex = 0;
  return cssValue.replace(CSS_URL_REGEX, (original, doubleQuoted, singleQuoted, unquoted) => {
    const url = doubleQuoted || singleQuoted || unquoted;
    if (!isInlinable(url)) return original;
    const dataUrl = urlMap.get(url);
    if (dataUrl) {
      if (onResolve) onResolve(true);
      return `url("${dataUrl}")`;
    }
    if (onResolve) onResolve(false);
    // `none` is valid as both a whole value and as a single layer inside a
    // comma-separated list (e.g. `url(a.png), none, linear-gradient(...)`).
    return 'none';
  });
}

async function fetchAsDataUrl(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) {
      debugLog('[NoxSpot] Resource fetch non-OK, stripping reference to avoid canvas taint', {
        url,
        status: response.status,
      });
      return null;
    }
    const blob = await response.blob();
    return await blobToDataUrl(blob);
  } catch (error) {
    debugLog('[NoxSpot] Resource fetch threw, stripping reference to avoid canvas taint', {
      url,
      error: String(error),
    });
    return null;
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function buildSvg(root, width, height) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const fo = document.createElementNS(SVG_NS, 'foreignObject');
  fo.setAttribute('x', '0');
  fo.setAttribute('y', '0');
  fo.setAttribute('width', '100%');
  fo.setAttribute('height', '100%');
  fo.appendChild(root);
  svg.appendChild(fo);

  return new XMLSerializer().serializeToString(svg);
}

function dumpSerializedSvgUrls(svgString) {
  const origin = location.origin;
  const urls = new Set();

  // Strip data: URI bodies before scanning — base64 payloads contain `//`
  // sequences that the protocol-relative regex would otherwise match as
  // pseudo-URLs. Replace the body with a placeholder so positions stay
  // roughly intact for any future logging.
  const scrubbed = svgString.replace(/data:[^"')\s]+/gi, 'data:STRIPPED');

  // Skip W3C namespace URIs (xmlns="http://www.w3.org/2000/svg" etc.) —
  // they're identifiers, the renderer never fetches them. Match both the
  // absolute (`https://www.w3.org/...`) and protocol-relative
  // (`//www.w3.org/...`) forms.
  const isNamespaceUri = (u) => /^(?:https?:)?\/\/www\.w3\.org\//i.test(u);

  const isCrossOrigin = (urlStr) => {
    try {
      const url = new URL(urlStr, origin);
      return url.protocol !== 'data:' && url.origin !== origin;
    } catch {
      return false;
    }
  };

  const absolute = scrubbed.match(/\bhttps?:\/\/[^\s"'<>)]+/gi) || [];
  absolute.forEach((u) => {
    if (!isNamespaceUri(u) && isCrossOrigin(u)) urls.add(u.slice(0, 200));
  });
  // Protocol-relative — require a real-looking host (dot in first segment,
  // no base64 chars) to avoid false positives from any data bodies the strip
  // pass missed.
  const protoRel = scrubbed.match(/(?:^|[^a-z])(\/\/[a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+\/[^\s"'<>+=]*)/gi) || [];
  protoRel.forEach((raw) => {
    const u = raw.replace(/^[^/]+/, '');
    if (!isNamespaceUri(u) && isCrossOrigin(u)) urls.add(u.slice(0, 200));
  });
  CSS_URL_REGEX.lastIndex = 0;
  let match;
  while ((match = CSS_URL_REGEX.exec(scrubbed)) !== null) {
    const inner = match[1] || match[2] || match[3];
    if (inner && isInlinable(inner) && !isNamespaceUri(inner) && isCrossOrigin(inner)) {
      urls.add(inner.slice(0, 200));
    }
  }

  // Element/attribute counts that could indicate a taint source the URL scan
  // can't see (e.g. <style> survived clone, <use> with href that didn't
  // strip, embedded <iframe>).
  const counts = {
    style: (svgString.match(/<style[\s>]/gi) || []).length,
    script: (svgString.match(/<script[\s>]/gi) || []).length,
    use: (svgString.match(/<use[\s>]/gi) || []).length,
    image: (svgString.match(/<image[\s>]/gi) || []).length,
    iframe: (svgString.match(/<iframe[\s>]/gi) || []).length,
    foreignObject: (svgString.match(/<foreignObject[\s>]/gi) || []).length,
    svgLength: svgString.length,
  };

  if (urls.size) {
    console.warn(
      '[NoxSpot] Rasterizer: cross-origin URLs found in serialized SVG (these tainted the canvas)',
      [...urls],
      counts,
    );
  } else {
    console.warn(
      '[NoxSpot] Rasterizer: canvas tainted but no cross-origin URLs visible in serialized SVG — taint may come from shadow DOM, web components, fonts, or UA-resolved refs',
      counts,
    );
  }
}

function svgToDataUrl(svgString) {
  // FileReader.readAsDataURL over a Blob handles UTF-8 natively and avoids
  // the multiple intermediate string copies that btoa(unescape(encodeURIComponent(...)))
  // produces for large SVGs. (unescape is also deprecated.)
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Failed to encode SVG as data URL'));
    reader.readAsDataURL(blob);
  });
}

function rasterizeSvg(svgString, width, height, background) {
  return new Promise((resolve, reject) => {
    // Data URL, not blob URL: blob: responses lack CORS headers, so the
    // browser can treat the loaded image as opaque and taint the canvas at
    // toDataURL even though the blob is technically same-origin. Data URLs
    // are unambiguously same-origin and never trigger this.
    const img = new Image();

    const cleanup = () => {
      clearTimeout(timer);
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('SVG rasterize timed out'));
    }, RASTERIZE_TIMEOUT_MS);

    img.onload = () => {
      cleanup();
      try {
        // Cap DPR so 4K/retina screens don't produce 5MB+ payloads that hit
        // the API's 7MB base64 ceiling (raw ~5MB). 1.5 keeps text crisp.
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        // JPEG requires an opaque background; fill white if no background
        // was provided so transparent SVG areas don't render black.
        ctx.fillStyle = background || '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      } catch (error) {
        // toDataURL throws SecurityError when anything the SVG referenced
        // was cross-origin without CORS. The pre-serialize audit couldn't
        // see it — dump every URL-shaped token from the serialized string
        // so we can find what slipped through (style tags, custom props,
        // non-standard attrs, shadow DOM leakage, etc.).
        if (error && /tainted|SecurityError/i.test(String(error))) {
          // Defensive: a diagnostic that throws would mask the real error.
          try { dumpSerializedSvgUrls(svgString); } catch {}
        }
        reject(error);
      }
    };
    img.onerror = () => {
      cleanup();
      reject(new Error('SVG failed to load as image'));
    };
    svgToDataUrl(svgString).then(
      (dataUrl) => { img.src = dataUrl; },
      (error) => { cleanup(); reject(error); },
    );
  });
}
