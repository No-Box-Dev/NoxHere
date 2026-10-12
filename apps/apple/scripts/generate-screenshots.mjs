#!/usr/bin/env node
/**
 * Generate Mac App Store screenshots for Planning.
 *
 * Pure HTML → PNG via Puppeteer. Each slot renders the menubar popover
 * mockup on a branded frame (warm stone surface + purple #6d5cc8 accent —
 * the app's own palette from Theme.swift, not a generic marketing wash).
 *
 * Story arc: tagline → live feed → status/notifications → PR timeline.
 * The App Store binary is the menubar popover only; no separate window.
 *
 * Output: fastlane/screenshots/en-US/0X_*.png at 2880x1800 (1440x900 @2x).
 * Run: npm run screenshots
 */

import puppeteer from 'puppeteer';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'fastlane', 'screenshots', 'en-US');
mkdirSync(OUT, { recursive: true });

// 1440x900 viewport at 2x = 2880x1800 PNG (the retina size ASC accepts for macOS).
const W = 1440, H = 900;

// Brand palette — matches NoxHere/Views/Theme.swift exactly.
const C = {
  surface: '#fafaf9',
  card: '#ffffff',
  border: '#e7e5e4',
  borderSoft: '#f5f5f4',
  accent: '#6d5cc8',
  accentSoft: '#f1eef9',
  textPrimary: '#1c1917',
  textBody: '#292524',
  textMuted: '#78716c',
  textTertiary: '#a8a29e',
};

const base = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: ${W}px; height: ${H}px;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
    background: ${C.surface};
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
  }
  .stage {
    position: relative;
    width: ${W}px; height: ${H}px;
    display: flex; flex-direction: column; align-items: center;
    padding: 70px 80px 60px;
  }
  .glow {
    position: absolute; width: 760px; height: 760px; border-radius: 50%;
    filter: blur(130px); opacity: 0.20; z-index: 0;
    background: ${C.accent}; top: -220px; right: -180px;
  }
  .glow.two { background: #b89464; top: auto; bottom: -260px; left: -200px; right: auto; opacity: 0.14; }
  .accent-bar {
    position: absolute; top: 0; left: 0; right: 0; height: 3px;
    background: linear-gradient(90deg, ${C.accent}, #b89464);
    z-index: 4;
  }
  .label {
    position: relative; z-index: 3;
    font-size: 13px; font-weight: 700; letter-spacing: 0.14em;
    color: ${C.accent}; text-transform: uppercase;
  }
  .headline {
    position: relative; z-index: 3;
    text-align: center; margin-top: 14px;
    font-size: 50px; font-weight: 700; line-height: 1.08;
    color: ${C.textPrimary}; letter-spacing: -0.01em;
  }
  .sub {
    position: relative; z-index: 3;
    text-align: center; margin-top: 16px;
    font-size: 19px; line-height: 1.45; color: ${C.textMuted};
    max-width: 760px;
  }
  .popover {
    position: relative; z-index: 3;
    margin-top: 34px;
    width: 540px; max-height: 560px;
    background: ${C.surface};
    border: 1px solid ${C.border};
    border-radius: 16px;
    box-shadow: 0 30px 60px -20px rgba(28,25,23,0.22), 0 8px 20px -12px rgba(28,25,23,0.14);
    overflow: hidden;
    display: flex; flex-direction: column;
  }
  .pop-header {
    display: flex; align-items: center; gap: 8px;
    padding: 14px 16px 12px;
    border-bottom: 1px solid ${C.border};
  }
  .pop-header .ic { color: ${C.accent}; font-size: 16px; }
  .pop-header .title { font-size: 14px; font-weight: 600; color: ${C.textPrimary}; }
  .pop-header .spacer { flex: 1; }
  .mode-pill {
    font-size: 11px; font-weight: 600; color: ${C.textMuted};
    background: ${C.borderSoft}; border: 1px solid ${C.border};
    padding: 3px 9px; border-radius: 7px;
  }
  .mode-pill.active { color: ${C.accent}; background: ${C.accentSoft}; border-color: transparent; }
  .feed { padding: 12px; display: flex; flex-direction: column; gap: 10px; overflow: hidden; }

  /* PostCard */
  .card {
    background: ${C.card}; border: 1px solid ${C.border}; border-radius: 12px;
    padding: 12px 14px;
  }
  .card-head { display: flex; align-items: center; gap: 8px; }
  .avatar {
    width: 26px; height: 26px; border-radius: 50%; flex: none;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700; color: #fff;
  }
  .who { font-size: 13px; font-weight: 600; color: ${C.textPrimary}; }
  .pills { display: flex; align-items: center; gap: 6px; margin-top: 3px; }
  .pill { font-size: 10.5px; font-weight: 600; padding: 2px 7px; border-radius: 6px; line-height: 1.5; }
  .pill.repo { color: ${C.accent}; background: ${C.accentSoft}; }
  .pill.mono { color: ${C.textMuted}; background: ${C.borderSoft}; font-family: ui-monospace, 'SF Mono', monospace; }
  .time { margin-left: auto; font-size: 10px; color: ${C.textTertiary}; }
  .divider { height: 1px; background: ${C.borderSoft}; margin: 10px 0; }
  .summary { font-size: 12.5px; line-height: 1.4; color: ${C.textBody}; }
  .linkrow { display: flex; align-items: center; gap: 5px; margin-top: 8px; font-size: 10.5px; color: ${C.accent}; font-weight: 500; }

  /* Timeline (status changes) */
  .tl-section { padding: 10px 14px 6px; }
  .tl-title { font-size: 10.5px; font-weight: 600; color: ${C.textPrimary}; }
  .tl-meta { font-size: 9.5px; color: ${C.textTertiary}; }
  .tl-list { padding: 4px 12px 14px; display: flex; flex-direction: column; gap: 6px; }
  .tl-row {
    display: flex; align-items: center; gap: 8px;
    background: ${C.card}; border: 1px solid ${C.border}; border-radius: 12px;
    padding: 9px 12px;
  }
  .tl-row .avatar { width: 24px; height: 24px; font-size: 10px; }
  .tl-event { font-size: 12.5px; font-weight: 600; color: ${C.textPrimary}; }
  .tl-sub { display: flex; align-items: center; gap: 6px; margin-top: 2px; }
  .tl-sub .at { font-size: 9.5px; color: ${C.textMuted}; }
`;

// Deterministic avatar colors (no network images).
const AVA = ['#6d5cc8', '#b89464', '#0d9488', '#3b82f6', '#ef4444', '#6e9970'];
function avatar(name, i) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return `<div class="avatar" style="background:${AVA[i % AVA.length]}">${initials}</div>`;
}

function card(name, i, repo, trigger, summary, time, link = 'Open on GitHub') {
  return `
    <div class="card">
      <div class="card-head">
        ${avatar(name, i)}
        <div>
          <div class="who">${name}</div>
          <div class="pills">
            <span class="pill repo">${repo}</span>
            <span class="pill mono">${trigger}</span>
          </div>
        </div>
        <span class="time">${time}</span>
      </div>
      <div class="divider"></div>
      <div class="summary">${summary}</div>
      <div class="linkrow"><span>↗</span><span>${link}</span></div>
    </div>`;
}

function feedHeader(active = 'Posts') {
  const modes = ['Posts', 'Opened', 'Current'];
  const pills = modes.map(m => `<span class="mode-pill ${m === active ? 'active' : ''}">${m}</span>`).join('');
  return `
    <div class="pop-header">
      <span class="ic">≣</span>
      <span class="title">NoxHere</span>
      <span class="spacer"></span>
      ${pills}
    </div>`;
}

function frame(headline, sub, popoverInner) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${base}</style></head>
  <body><div class="stage">
    <div class="accent-bar"></div>
    <div class="glow"></div>
    <div class="glow two"></div>
    <div class="label">NoxHere</div>
    <div class="headline">${headline}</div>
    <div class="sub">${sub}</div>
    <div class="popover">${popoverInner}</div>
  </div></body></html>`;
}

const SLOTS = [
  {
    file: '01_feed.png',
    headline: 'Your team&#39;s PR feed,<br>in the menubar.',
    sub: 'Every PR opened, merged, and released — narrated in first person so scanning is fast. No browser needed.',
    popover: feedHeader('Posts') + `<div class="feed">
        ${card('Aisha Khan', 0, 'api-backend', 'MERGED', 'Consolidated the report-render path so nightlies finish in a third of the time and stop timing out on large orgs.', '2h ago')}
        ${card('Umar Sheikh', 1, 'react-frontend', 'OPENED', 'Trimmed the list-page search term before it hits the API — kills the empty-query flood that was doubling request volume.', '5h ago')}
        ${card('Marco Diaz', 2, 'helix-parser', 'RELEASE', 'Shipped genetic variant extraction with RSID support; release notes attached for the full changelog.', '1d ago')}
      </div>`,
  },
  {
    file: '02_current.png',
    headline: 'See who&#39;s shipping what,<br>right now.',
    sub: 'The Current tab shows every person&#39;s open PRs and assigned issues with live status badges — at a glance.',
    popover: feedHeader('Current') + `<div class="feed">
        ${card('Aisha Khan', 0, 'api-backend', 'CHANGES MADE', 'Rebased on main after review feedback; the authz fix now passes the cross-patient IDOR suite.', '17h ago')}
        ${card('Umar Sheikh', 1, 'react-frontend', 'CHANGES MADE', 'Pushed a follow-up commit tightening the debounce on the search box so it no longer fires on every keystroke.', '1d ago')}
        ${card('Marco Diaz', 2, 'helix-parser', 'OPENED', 'Drafting the variant-position normalizer behind a feature flag so it can land without disrupting the pipeline.', '3d ago')}
      </div>`,
  },
  {
    file: '03_notifications.png',
    headline: 'Never miss a review,<br>merge, or mention.',
    sub: 'Native macOS notifications when new activity lands — click straight to the PR on GitHub. You stay in the loop without watching a browser tab.',
    popover: feedHeader('Opened') + `<div class="feed">
        ${card('Aisha Khan', 0, 'api-backend', 'REVIEW', 'Approved the report-version endpoint with one suggestion: surface the content hash in the response for cache invalidation.', '1h ago')}
        ${card('Umar Sheikh', 1, 'api-backend', 'MERGED', 'Merged the PHI authorization move to Keto — at parity with the legacy check and the old route is now deprecated.', '6h ago')}
        ${card('Marco Diaz', 2, 'nexus-platform', 'OPENED', 'Opened the longitudinal health-summary refactor; the old projection was double-counting biomarker bands near the cutoff.', '8h ago')}
      </div>`,
  },
  {
    file: '04_timeline.png',
    headline: 'Open any PR for the<br>full status timeline.',
    sub: 'A compact, status-only history of each PR — who opened, reviewed, requested changes, and merged. All inside the popover.',
    popover: feedHeader('Posts') + `
      <div class="pop-header" style="border-top:1px solid ${C.border};">
        <span class="ic" style="color:${C.accent}">‹</span>
        <div>
          <div class="who" style="font-size:12.5px">react-frontend #571</div>
          <div style="font-size:10px;color:${C.textMuted}">Trim the list-page search term before it reaches the API</div>
        </div>
      </div>
      <div class="tl-section" style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid ${C.borderSoft}">
        <span class="tl-title">Status changes</span>
        <span class="tl-meta">Last 3 days</span>
      </div>
      <div class="tl-list">
        <div class="tl-row">${avatar('Umar Sheikh',1)}<div><div class="tl-event">Changes made</div><div class="tl-sub"><span class="pill mono">CHANGES</span><span class="at">@umars · 17h ago</span></div></div></div>
        <div class="tl-row">${avatar('Aisha Khan',0)}<div><div class="tl-event">Requested changes</div><div class="tl-sub"><span class="pill mono">REVIEW</span><span class="at">@aisha · 1d ago</span></div></div></div>
        <div class="tl-row">${avatar('Jasper M',3)}<div><div class="tl-event">Opened the PR</div><div class="tl-sub"><span class="pill repo">react-frontend</span><span class="at">@jasper · 2d ago</span></div></div></div>
      </div>`,
  },
];

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });

for (const slot of SLOTS) {
  await page.setContent(frame(slot.headline, slot.sub, slot.popover), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const path = join(OUT, slot.file);
  await page.screenshot({ path, omitBackground: false });
  console.log('wrote', slot.file);
}

await browser.close();
console.log(`Done — ${SLOTS.length} screenshots in ${OUT}`);
