// ===== Unticket · Kanban Agent — local interactive prototype =====
// Fully local. No storage. Walk the flow: create → start → run → open PR → merge.
"use strict";

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const AGENTS = {
  claude: { name: "Claude Code", glyph: "✦", chip: "claude" },
  codex:  { name: "Codex",       glyph: "◆", chip: "codex"  },
  cline:  { name: "Cline",       glyph: "◈", chip: "cline"  },
};

const COLUMNS = [
  { key: "backlog",  label: "Backlog" },
  { key: "progress", label: "In Progress" },
  { key: "review",   label: "Review" },
  { key: "done",     label: "Done" },
];

// DOM refs
const board    = $(".board");
const panel    = $("#run-panel");
const scrim    = $("#scrim");
const composer = $("#composer");
const toastEl  = $("#toast");
const toastCopy = $("#toast-copy");
let toastTimer;

// Counters + live run state
let seq    = 417;          // next task number
let prSeq  = 419;          // next PR number
const timers   = {};       // taskId -> interval id
const liveClock = {};      // taskId -> seconds elapsed (while running)

// ---------------- State + seed ----------------
const state = { selectedId: null, tasks: [] };

function uid()   { return "task-" + seq++; }
function nextPR(){ return prSeq++; }
function slug(t){ return (t || "task").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 28) || "task"; }
function topEvent(t){ return t.events[0]; }

function seed() {
  state.tasks = [
    {
      title: "Add latest action to PR cards", subtitle: "Show one status with event dropdown",
      agent: "codex", column: "progress", running: true, progress: 64, branch: "feature/latest-action",
      events: [
        { tone: "running", icon: "●", color: "blue",   label: "Running tests",        sub: "Codex · 38s" },
        { tone: "neutral", icon: "✓",                  label: "Interface implemented", sub: "Codex · 4m" },
        { tone: "neutral", icon: "↗",                  label: "Worktree created",      sub: "Runner · 18m" },
      ],
    },
    {
      title: "Connect runner authentication", subtitle: "Scoped token and repo allowlist",
      agent: "cline", column: "progress", running: false, progress: 45, branch: "feature/runner-auth",
      events: [
        { tone: "blocked", icon: "!", color: "amber", label: "Needs input",       sub: "Choose runner scope · 8m" },
        { tone: "neutral", icon: "✓",                 label: "Token endpoint added", sub: "Cline · 13m" },
      ],
    },
    {
      title: "Review PR timeline UI", subtitle: "Confirm changes made and bot reviewed",
      agent: "bot", column: "review", running: false, progress: 100, branch: "feature/pr-timeline", pr: { number: 418 },
      events: [
        { tone: "changes", icon: "✓", color: "green",  label: "Changes made",        sub: "Codex pushed 2 commits · 4m" },
        { tone: "neutral", icon: "↩", color: "amber",  label: "Changes requested",   sub: "Sarah · 41m" },
        { tone: "neutral", icon: "◆", color: "purple", label: "Bot reviewed",        sub: "Unticket Agent · 48m" },
        { tone: "neutral", icon: "○",                  label: "Draft opened",        sub: "Codex · 1h" },
      ],
    },
    {
      title: "Define PR status event model", subtitle: "Capture latest titled event per PR",
      agent: "claude", column: "backlog", running: false, progress: 0,
      events: [
        { tone: "ready", icon: "○", label: "Ready to start", sub: "Spec is approved · 2h" },
        { tone: "neutral", icon: "◆", label: "Task created", sub: "Jasper · 2h" },
      ],
    },
    {
      title: "Backfill PR events", subtitle: "Last 3 days for this repository",
      agent: "codex", column: "backlog", running: false, progress: 0,
      events: [
        { tone: "queued", icon: "○", label: "Queued", sub: "Waiting for runner · 1d" },
        { tone: "neutral", icon: "◆", label: "Task created", sub: "Jasper · 1d" },
      ],
    },
    {
      title: "Create agent task API", subtitle: "D1 state and run events",
      agent: "codex", column: "done", running: false, progress: 100, pr: { number: 416 },
      events: [
        { tone: "merged", icon: "✓", color: "green",  label: "Merged",      sub: "main · 1h" },
        { tone: "neutral", icon: "◆", color: "purple", label: "Bot reviewed", sub: "Unticket Agent · 2h" },
      ],
    },
  ].map((t) => ({ ...t, id: uid(), num: nextTaskNum() }));
  // The seeded running task starts live immediately so the board feels alive.
  const live = state.tasks.find((t) => t.running);
  if (live) { liveClock[live.id] = 38; startTimer(live); }
}

// Keep visible numbers ascending & tidy (416..421 in seed order)
let _num = 416;
function nextTaskNum() { return ++_num; }

// ---------------- Rendering ----------------
function taskById(id) { return state.tasks.find((t) => t.id === id); }

function render() {
  for (const col of COLUMNS) {
    const colEl = $(`.board-column[data-col="${col.key}"]`);
    const body = $(".column-body", colEl);
    const tasks = state.tasks.filter((t) => t.column === col.key);
    $(".column-count", colEl).textContent = tasks.length;
    body.innerHTML = tasks.length
      ? tasks.map(cardHTML).join("")
      : `<div class="column-empty">No tasks</div>`;
  }
  $$(".task-card").forEach((c) => c.classList.toggle("selected", c.dataset.task === state.selectedId));
  if (state.selectedId) renderPanel(taskById(state.selectedId));
}

function agentChip(t) {
  if (t.agent === "bot") return `<span class="agent-chip bot"><span>◆</span> Bot reviewed</span>`;
  const a = AGENTS[t.agent];
  return `<span class="agent-chip ${a.chip}"><span>${a.glyph}</span> ${a.name}</span>`;
}

function timeHTML(t) {
  if (t.running) return `<span class="task-time live">● ${liveClock[t.id] || 0}s</span>`;
  const m = /·\s*([0-9]+\s*[hmds]+)/i.exec(topEvent(t).sub || "");
  return `<span class="task-time">${m ? m[1].replace(/\s+/g, "") : ""}</span>`;
}

function eventRowHTML(t) {
  const e = topEvent(t);
  let lead;
  if (t.pr && (t.column === "review" || t.column === "done")) lead = `<span class="pr-badge">PR</span>`;
  else if (e.tone === "running") lead = `<span class="agent-pulse">●</span>`;
  else lead = `<span class="event-dot"></span>`;
  const label = (t.pr ? `#${t.pr.number} · ` : "") + e.label;
  return `<button class="task-event ${e.tone}" type="button" data-dropdown="${t.id}">${lead}<span><b>${label}</b><small>${e.sub}</small></span><span class="event-chevron">⌄</span></button>`;
}

function menuHTML(t) {
  const heading = t.pr
    ? `PR #${t.pr.number} timeline <a href="#" data-mock-link>Open PR ↗</a>`
    : `Task timeline`;
  const rows = t.events.map((e, i) =>
    `<div class="menu-row ${i === 0 ? "current" : ""}"><i class="${e.color || ""}">${e.icon}</i><span><b>${e.label}</b><small>${e.sub}</small></span></div>`).join("");
  return `<div class="event-menu" id="${t.id}"><div class="menu-heading">${heading}</div>${rows}</div>`;
}

function ctaHTML(t) {
  const tone = topEvent(t).tone;
  let action = null, label = "", secondary = false;
  if (tone === "ready")        { action = "start";  label = "▶ Start task"; }
  else if (tone === "queued")  { action = "start";  label = "▶ Start queued task"; }
  else if (tone === "blocked") { action = "resume"; label = "Provide input & resume"; secondary = true; }
  else if (tone === "passed")  { action = "openpr"; label = "↗ Open PR"; }
  else if (tone === "changes") { action = "merge";  label = "✓ Merge PR"; }
  else return "";
  return `<button class="task-cta ${secondary ? "secondary" : ""}" data-action="${action}" data-task="${t.id}">${label}</button>`;
}

function cardHTML(t) {
  const cls = ["task-card"];
  if (t.running) cls.push("active-card");
  if (t.column === "done") cls.push("done-card");
  const progress = t.running ? `<div class="task-progress"><span style="width:${t.progress}%"></span></div>` : "";
  const footer = (t.branch && (t.column === "progress" || t.column === "review"))
    ? `<div class="task-footer"><span class="branch-label">⌘ ${t.branch}</span><button class="terminal-button" type="button" data-open="${t.id}">${t.pr ? "▣ Diff" : "▣ CLI"}</button></div>` : "";
  return `<article class="${cls.join(" ")}" data-task="${t.id}" tabindex="0">
    <div class="task-title">${t.title}</div>
    <div class="task-subtitle">${t.subtitle}</div>
    <div class="task-meta">${agentChip(t)}${timeHTML(t)}</div>
    ${eventRowHTML(t)}
    ${menuHTML(t)}
    ${ctaHTML(t)}
    ${progress}
    ${footer}
  </article>`;
}

// Targeted live update (avoids rebuilding DOM / closing open dropdowns each tick)
function updateCardLive(t) {
  const card = $(`.task-card[data-task="${t.id}"]`);
  if (!card) return;
  const bar = $(".task-progress span", card);
  if (bar) bar.style.width = t.progress + "%";
  const time = $(".task-time", card);
  if (time) { time.classList.add("live"); time.textContent = "● " + (liveClock[t.id] || 0) + "s"; }
  const small = $(".task-event small", card);
  if (small && topEvent(t).tone === "running") small.textContent = `${AGENTS[t.agent].name} · ${liveClock[t.id]}s`;
}

// ---------------- Run panel ----------------
function openPanel(id) {
  state.selectedId = id;
  render();
  panel.classList.add("open");
  scrim.classList.add("visible");
  renderPanel(taskById(id));
}
function closePanel() {
  state.selectedId = null;
  panel.classList.remove("open");
  scrim.classList.remove("visible");
  render();
}

function renderPanel(t) {
  if (!t) return;
  // Contextual advance action mirrors the card CTA, so the flow can be driven from the panel
  const adv = $("#run-advance");
  const tone0 = topEvent(t).tone;
  let aLabel = null, aAction = null, aSecondary = false;
  if (tone0 === "ready")        { aLabel = "▶ Start task";          aAction = "start"; }
  else if (tone0 === "queued")  { aLabel = "▶ Start queued task";   aAction = "start"; }
  else if (tone0 === "blocked") { aLabel = "Provide input & resume"; aAction = "resume"; aSecondary = true; }
  else if (tone0 === "passed")  { aLabel = "↗ Open PR";             aAction = "openpr"; }
  else if (tone0 === "changes") { aLabel = "✓ Merge PR";            aAction = "merge"; }
  if (aLabel) { adv.classList.remove("hidden"); adv.classList.toggle("secondary", aSecondary); adv.textContent = aLabel; adv.dataset.action = aAction; }
  else { adv.classList.add("hidden"); adv.dataset.action = ""; }
  $("#stop-run").disabled = !t.running;

  $("#run-kicker").textContent = "TASK #" + t.num;
  $("#run-title").textContent = t.title;
  const a = AGENTS[t.agent] || { name: "Unticket Agent", glyph: "◆" };
  const agentName = t.agent === "bot" ? "Unticket Agent" : a.name;
  const tone = topEvent(t).tone;
  let status;
  if (t.running) status = `${agentName} is working`;
  else if (tone === "merged") status = `${agentName} merged this`;
  else if (tone === "passed") status = `${agentName} finished`;
  else if (tone === "blocked") status = `${agentName} is paused`;
  else if (tone === "changes") status = `${agentName} opened a PR`;
  else status = `${agentName} is ready`;
  $("#run-agent-name").textContent = status;
  $("#run-logo").textContent = t.agent === "bot" ? "◆" : (a.glyph || "◆");

  const live = $("#run-live");
  if (t.running) { live.textContent = "LIVE"; live.style.color = "var(--green)"; }
  else if (tone === "merged" || tone === "passed") { live.textContent = tone === "merged" ? "DONE" : "READY"; live.style.color = "var(--green)"; }
  else if (tone === "blocked") { live.textContent = "PAUSED"; live.style.color = "var(--amber)"; }
  else if (tone === "changes") { live.textContent = "REVIEW"; live.style.color = "var(--accent-hover)"; }
  else { live.textContent = "IDLE"; live.style.color = "var(--text-tertiary)"; }

  renderTerminal(t);
  renderLatest(t);
  renderTimeline(t);
}

function renderTerminal(t) {
  const pre = $("#run-terminal");
  const branch = t.branch || ("feature/" + slug(t.title));
  $("#run-term-branch").textContent = "Terminal · " + branch;
  const top = topEvent(t);
  if (t.running) {
    const elapsed = liveClock[t.id] || 0;
    const tail = elapsed > 8 ? `<span class="ok">✓ integration/feed · 8 passed</span>`
              : elapsed > 4 ? `<span class="dim">› running integration…</span>`
              : `<span class="ok">✓ unit/${slug(t.title)} · 12 passed</span>`;
    pre.innerHTML = `<span class="prompt">$</span> npm test -- --run src/lib/${slug(t.title)}<br>${tail}<br><span class="dim">… ${elapsed}s elapsed · ${t.progress}%</span>`;
  } else if (top.tone === "merged") {
    pre.innerHTML = `<span class="prompt">$</span> gh pr merge ${t.pr ? t.pr.number : ""} --squash<br><span class="ok">✓ merged into main</span>`;
  } else if (top.tone === "passed") {
    pre.innerHTML = `<span class="prompt">$</span> npm test<br><span class="ok">✓ all suites green</span><br><span class="dim">ready to open PR</span>`;
  } else if (top.tone === "changes") {
    pre.innerHTML = `<span class="prompt">$</span> git push origin ${branch}<br><span class="ok">✓ 2 commits pushed</span><br><span class="dim">awaiting review</span>`;
  } else if (top.tone === "blocked") {
    pre.innerHTML = `<span class="prompt">$</span> ⏸ paused — needs input<br><span class="dim">worktree preserved</span>`;
  } else {
    pre.innerHTML = `<span class="prompt">$</span> idle — press <b>Start</b> to run<br><span class="dim">${branch}</span>`;
  }
}

function describeLatest(t) {
  const tone = topEvent(t).tone;
  if (tone === "running") return `Validating ${slug(t.title)} and streaming events`;
  if (tone === "passed")  return "All tests green — ready to open a PR";
  if (tone === "merged")  return `Merged into main via PR #${t.pr ? t.pr.number : "—"}`;
  if (tone === "changes") return `Commits pushed to ${t.branch || "the branch"} — awaiting review`;
  if (tone === "blocked") return "Agent paused, waiting for a decision";
  return "Sitting in Backlog, ready when you are";
}

function renderLatest(t) {
  const top = topEvent(t);
  const la = $("#run-latest");
  la.className = "large-action " + (["running", "passed", "blocked", "changes", "merged"].includes(top.tone) ? top.tone : "ready");
  const lead = top.tone === "running" ? `<span class="agent-pulse">●</span>` : `<span class="event-dot"></span>`;
  const label = (t.pr && (t.column === "review" || t.column === "done") ? `#${t.pr.number} · ` : "") + top.label;
  la.innerHTML = `${lead}<div><b>${label}</b><small>${describeLatest(t)}</small></div>`;
  $("#run-latest-time").textContent = t.running ? `${liveClock[t.id] || 0}s` : "just now";
}

function renderTimeline(t) {
  $("#run-timeline").innerHTML = t.events.map((e, i) =>
    `<div class="run-event ${i === 0 ? "active" : ""}"><i></i><div><b>${e.label}</b><small>${e.sub}</small></div></div>`).join("");
  $("#run-events-count").textContent = t.events.length + (t.events.length === 1 ? " event" : " events");
}

// ---------------- Flow transitions ----------------
function pushEvent(t, ev) { t.events.unshift(ev); }

function startRun(t, silent) {
  if (!t || t.running) return;
  t.column = "progress";
  t.running = true;
  t.progress = (t.progress > 0 && t.progress < 100) ? t.progress : 0;
  if (!t.branch) t.branch = "feature/" + slug(t.title);
  liveClock[t.id] = liveClock[t.id] || 0;
  pushEvent(t, { tone: "neutral", icon: "↗", label: "Worktree created", sub: "Runner · just now" });
  pushEvent(t, { tone: "running", icon: "●", color: "blue", label: "Running tests", sub: `${AGENTS[t.agent].name} · 0s` });
  startTimer(t);
  render();
  if (!silent) toast(`${AGENTS[t.agent].name} started · ${t.title}`);
}

function startTimer(t) {
  if (timers[t.id]) return;
  timers[t.id] = setInterval(() => {
    const task = taskById(t.id);
    if (!task || !task.running) { stopTimer(t.id); return; }
    liveClock[task.id] = (liveClock[task.id] || 0) + 1;
    task.progress = Math.min(100, task.progress + 4 + Math.floor(Math.random() * 4));
    const top = task.events[0];
    if (top && top.tone === "running") top.sub = `${AGENTS[task.agent].name} · ${liveClock[task.id]}s`;
    updateCardLive(task);
    if (state.selectedId === task.id) renderPanel(task);
    if (task.progress >= 100) finishRun(task);
  }, 1200);
}
function stopTimer(id) { if (timers[id]) { clearInterval(timers[id]); delete timers[id]; } }

function finishRun(t) {
  t.running = false; t.progress = 100; stopTimer(t.id);
  pushEvent(t, { tone: "passed", icon: "✓", color: "green", label: "Tests passed", sub: `${AGENTS[t.agent].name} · just now` });
  render();
  if (state.selectedId === t.id) renderPanel(t);
  toast(`Tests passed — ready to open PR · ${t.title}`);
}

function resumeRun(t) {
  if (!t) return;
  t.running = true; liveClock[t.id] = liveClock[t.id] || 0;
  pushEvent(t, { tone: "running", icon: "●", color: "blue", label: "Running tests", sub: `${AGENTS[t.agent].name} · resuming` });
  startTimer(t); render();
  toast(`Resumed · ${t.title}`);
}

function openPR(t) {
  if (!t) return;
  t.column = "review"; t.pr = { number: nextPR() };
  if (!t.branch) t.branch = "feature/" + slug(t.title);
  pushEvent(t, { tone: "neutral", icon: "◆", color: "purple", label: "Bot reviewed",      sub: "Unticket Agent · just now" });
  pushEvent(t, { tone: "neutral", icon: "↩", color: "amber",  label: "Changes requested", sub: "Review bot · 1m" });
  pushEvent(t, { tone: "changes", icon: "✓", color: "green",  label: "Changes made",      sub: `${AGENTS[t.agent].name} pushed 2 commits · just now` });
  render();
  toast(`PR #${t.pr.number} opened · ${t.title}`);
}

function mergeTask(t) {
  if (!t) return;
  if (!t.pr) t.pr = { number: nextPR() };
  t.column = "done"; t.running = false; stopTimer(t.id);
  pushEvent(t, { tone: "merged", icon: "✓", color: "green", label: "Merged", sub: "main · just now" });
  render();
  toast(`PR #${t.pr.number} merged · ${t.title}`);
}

function stopTask(t) {
  if (!t) return;
  if (!t.running) { toast("Agent isn't running"); return; }
  t.running = false; stopTimer(t.id);
  pushEvent(t, { tone: "blocked", icon: "■", color: "amber", label: "Stopped", sub: "Worktree preserved · just now" });
  render(); renderPanel(t);
  toast("Agent stopped — worktree is preserved");
}

function handleAction(action, id) {
  const t = taskById(id);
  if (action === "start")  startRun(t);
  else if (action === "resume") resumeRun(t);
  else if (action === "openpr") openPR(t);
  else if (action === "merge")  mergeTask(t);
}

function startBacklog() {
  const bs = state.tasks.filter((t) => t.column === "backlog");
  if (!bs.length) { toast("Backlog is empty"); return; }
  bs.forEach((t) => startRun(t, true));
  toast(`Started ${bs.length} backlog task${bs.length > 1 ? "s" : ""}`);
}

// ---------------- Create-task composer ----------------
let pickedAgent = "codex";
function openComposer() { composer.classList.add("open"); setTimeout(() => $("#composer-title").focus(), 0); }
function closeComposer() { composer.classList.remove("open"); $("#composer-title").value = ""; $("#composer-sub").value = ""; }

function createTask() {
  const title = $("#composer-title").value.trim();
  if (!title) { $("#composer-title").focus(); return; }
  const sub = $("#composer-sub").value.trim() || "New task";
  const t = {
    id: uid(), num: nextTaskNum(), title, subtitle: sub, agent: pickedAgent,
    column: "backlog", running: false, progress: 0,
    events: [
      { tone: "ready",   icon: "○", label: "Ready to start", sub: "Waiting to run · just now" },
      { tone: "neutral", icon: "◆", label: "Task created",   sub: "You · just now" },
    ],
  };
  state.tasks.unshift(t);
  closeComposer(); render();
  toast(`Task created · ${title}`);
}

// ---------------- Toast ----------------
function showToast(message) { toast(message); }
function toast(message) {
  toastCopy.textContent = message;
  toastEl.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove("show"), 2400);
}

// ---------------- Menus ----------------
function toggleMenu(id) {
  const m = document.getElementById(id);
  if (!m) return;
  const willOpen = !m.classList.contains("open");
  closeAllMenus();
  if (willOpen) m.classList.add("open");
}
function closeAllMenus() { $$(".event-menu.open").forEach((m) => m.classList.remove("open")); }

// ---------------- Wiring ----------------
function wire() {
  // Board: delegation for cards, dropdowns, CTAs, open panel
  board.addEventListener("click", (ev) => {
    const link = ev.target.closest("[data-mock-link]");
    if (link) { ev.preventDefault(); ev.stopPropagation(); toast("This is a local mock link"); return; }
    if (ev.target.closest(".event-menu")) { ev.stopPropagation(); return; }   // keep menu open on inside clicks
    const card = ev.target.closest(".task-card");
    if (!card) return;
    const id = card.dataset.task;
    const dd = ev.target.closest("[data-dropdown]");
    if (dd) { ev.stopPropagation(); toggleMenu(id); return; }
    const cta = ev.target.closest("[data-action]");
    if (cta) { handleAction(cta.dataset.action, cta.dataset.task); return; }
    if (ev.target.closest("[data-open]")) { openPanel(id); return; }
    openPanel(id);
  });
  board.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter" && ev.key !== " ") return;
    const card = ev.target.closest(".task-card");
    if (card && !ev.target.closest("[data-dropdown]") && !ev.target.closest("[data-action]")) {
      ev.preventDefault(); openPanel(card.dataset.task);
    }
  });
  document.addEventListener("click", closeAllMenus);

  // Run panel controls
  $("#close-run").addEventListener("click", closePanel);
  scrim.addEventListener("click", closePanel);
  $("#stop-run").addEventListener("click", () => stopTask(taskById(state.selectedId)));
  $("#run-advance").addEventListener("click", () => {
    const t = taskById(state.selectedId);
    const action = $("#run-advance").dataset.action;
    if (t && action) handleAction(action, t.id);
  });
  $("#send-feedback").addEventListener("click", () => toast("Feedback composer would open here"));

  // Composer
  $("#new-task").addEventListener("click", openComposer);
  $("#sidebar-new-task").addEventListener("click", openComposer);
  $("#composer-create").addEventListener("click", createTask);
  $("#composer-cancel").addEventListener("click", closeComposer);
  $("#composer-title").addEventListener("keydown", (ev) => { if (ev.key === "Enter") createTask(); });
  $("#composer").addEventListener("click", (ev) => { if (ev.target === $("#composer")) closeComposer(); });
  $$(".agent-pick button").forEach((b) => b.addEventListener("click", () => {
    $$(".agent-pick button").forEach((x) => x.classList.remove("active"));
    b.classList.add("active"); pickedAgent = b.dataset.agent;
  }));

  // Sidebar / header misc
  $("#sidebar-start-backlog").addEventListener("click", startBacklog);
  $("#add-project").addEventListener("click", () => toast("Project picker would open here"));
  $("#git-toggle").addEventListener("click", () => toast("Git view would toggle here"));
  $("#sidebar-settings").addEventListener("click", () => toast("Settings would open here"));
  $("#sidebar-git").addEventListener("click", () => toast("Git view would toggle here"));
  $$(".column-trash").forEach((t) => t.addEventListener("click", () => {
    const n = state.tasks.filter((x) => x.column === "done").length;
    state.tasks = state.tasks.filter((x) => x.column !== "done");
    if (state.selectedId && !taskById(state.selectedId)) closePanel();
    render();
    toast(n ? `Archived ${n} completed task${n > 1 ? "s" : ""}` : "Nothing to archive");
  }));
  $$(".mode-switch .mode").forEach((b) => b.addEventListener("click", () => {
    $$(".mode-switch .mode").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
  }));
  $$(".sidebar [data-mock-link]").forEach((l) => l.addEventListener("click", (ev) => { ev.preventDefault(); toast("This is a local mock link"); }));

  // Keyboard shortcuts
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      closeAllMenus();
      if (composer.classList.contains("open")) closeComposer();
      else closePanel();
      return;
    }
    const typing = /^(input|textarea|select)$/i.test((ev.target.tagName || ""));
    if (typing) return;
    if (ev.key === "c" || ev.key === "C") { ev.preventDefault(); openComposer(); }
    else if (ev.shiftKey && (ev.key === "b" || ev.key === "B")) { ev.preventDefault(); startBacklog(); }
  });
}

// ---------------- Boot ----------------
seed();
render();
wire();
