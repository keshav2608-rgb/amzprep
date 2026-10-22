// DSA problem tracker: LeetCode-style filterable list, progress sidebar and problem dialog.

import { $, $$, esc, download } from "../lib/dom.js";
import { PROBLEMS } from "../data/problems.js";
import { BLIND_75, PRESETS, GRAPH_TOPICS, STATUS_LABEL, CONFIDENCE_LABEL } from "../config/tracker.js";
import { LIMITS } from "../lib/validate.js";
import { toast } from "../lib/toast.js";
import {
  progress, statusOf, setStatus, cycleStatus, setStarred,
  setConfidence, setNote, importProgress, exportProgress, streakInfo
} from "../services/progress.js";

const STATUS_ICON = {
  completed: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  in_progress: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none"/></svg>',
  todo: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" stroke-dasharray="3 3"/></svg>'
};
const STAR_SVG = '<svg viewBox="0 0 24 24"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6-4.5-4.2 6.1-.8z"/></svg>';
const NOTE_SVG = '<svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
const DIFF_WEIGHT = { EASY: 1, MEDIUM: 2, HARD: 3 };

const TOPIC_COUNTS = (() => {
  const m = new Map();
  PROBLEMS.forEach(p => p.topics.forEach(t => m.set(t, (m.get(t) || 0) + 1)));
  return [...m].sort((a, b) => b[1] - a[1]);
})();
const RANK = new Map(PROBLEMS.map((p, i) => [p.id, i]));
const VALID_IDS = new Set(PROBLEMS.map(p => p.id));
const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
const diffName = d => d[0] + d.slice(1).toLowerCase();

// View state (filters, sort, paging) — not persisted
const view = { q: "", diff: "ALL", status: "ALL", topics: new Set(), preset: "all", sort: "freq", dir: -1, page: 1, size: 50, allTopics: false };

export function trackerHTML() {
  return `<div class="lc">
    <div class="lc-main">
      <div class="chips" id="lc-topics"></div>
      <div class="presets" id="lc-presets">${PRESETS.map(([k, l]) => `<button class="preset" data-p="${k}">${l}</button>`).join("")}</div>
      <div class="toolbar">
        <div class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
          <input class="input" id="lc-q" placeholder="Search questions or topics  ( / )"></div>
        <select class="input" id="lc-diff"><option value="ALL">Difficulty</option><option value="EASY">Easy</option><option value="MEDIUM">Medium</option><option value="HARD">Hard</option></select>
        <select class="input" id="lc-status"><option value="ALL">Status</option><option value="todo">To do</option><option value="in_progress">Attempting</option><option value="completed">Solved</option><option value="starred">Starred</option></select>
        <button class="btn" id="lc-pick" title="Open a random problem from the current list">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>Pick one</button>
      </div>
      <div class="active-filters" id="lc-active"></div>
      <div class="lc-table">
        <div class="lc-row lc-head">
          <span>Status</span>
          <span><button data-sort="title">Title</button></span>
          <span class="c-acc"><button data-sort="acc">Acceptance</button></span>
          <span><button data-sort="diff">Difficulty</button></span>
          <span class="c-freq"><button data-sort="freq">Frequency</button></span>
          <span></span>
        </div>
        <div class="lc-body" id="lc-body"></div>
      </div>
      <div class="lc-foot">
        <span id="lc-count"></span>
        <div class="pager" id="lc-pager"></div>
        <select class="input btn-sm" id="lc-size" style="width:auto"><option value="25">25 / page</option><option value="50" selected>50 / page</option><option value="100">100 / page</option></select>
      </div>
    </div>
    <aside class="lc-side">
      <div class="card" id="lc-progress"></div>
      <div class="card" id="lc-today"></div>
      <div class="card">
        <div class="card-head" style="margin-bottom:10px"><h3>Backup</h3><small>JSON file</small></div>
        <div style="display:flex;gap:8px"><button class="btn btn-sm" id="lc-export">Export</button><button class="btn btn-sm" id="lc-import">Import</button>
        <input type="file" id="lc-file" accept=".json,application/json" hidden></div>
      </div>
    </aside>
  </div>
  <dialog class="modal" id="lc-dialog"></dialog>`;
}

let keyboardBound = false;

export function initTracker() {
  const refilter = () => { view.page = 1; renderTracker(); };
  let debounce;
  $("#lc-q").oninput = e => { clearTimeout(debounce); debounce = setTimeout(() => { view.q = e.target.value; refilter(); }, 120); };
  $("#lc-diff").onchange = e => { view.diff = e.target.value; refilter(); };
  $("#lc-status").onchange = e => { view.status = e.target.value; refilter(); };
  $("#lc-size").onchange = e => { view.size = +e.target.value; refilter(); };
  $$("#lc-presets .preset").forEach(b => b.onclick = () => { view.preset = b.dataset.p; refilter(); });
  $$(".lc-head [data-sort]").forEach(b => b.onclick = () => {
    if (view.sort === b.dataset.sort) view.dir *= -1;
    else { view.sort = b.dataset.sort; view.dir = view.sort === "title" || view.sort === "diff" ? 1 : -1; }
    renderTracker();
  });
  $("#lc-pick").onclick = () => {
    const pool = filteredProblems();
    const list = pool.length ? pool : PROBLEMS;
    openProblem(list[Math.floor(Math.random() * list.length)].id);
  };

  $("#lc-body").onclick = e => {
    const b = e.target.closest("button[data-a]");
    if (!b) return;
    const id = +b.closest(".lc-row").dataset.id;
    if (b.dataset.a === "note") return openProblem(id);
    if (b.dataset.a === "status") cycleStatus(id);
    if (b.dataset.a === "star") setStarred(id, !progress().starred[id]);
    renderTracker(false);
  };

  $("#lc-export").onclick = () => {
    const blob = new Blob([JSON.stringify(exportProgress(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    download(`leetcode_tracker_backup_${new Date().toISOString().slice(0, 10)}.json`, url);
    URL.revokeObjectURL(url);
  };
  $("#lc-import").onclick = () => $("#lc-file").click();
  $("#lc-file").onchange = async e => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) return toast("That file is too large to be a tracker backup.", "error");
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      return toast("That file isn't a valid tracker backup.", "error");
    }
    try {
      const count = await importProgress(parsed.userData || parsed, VALID_IDS);
      renderTracker();
      toast(`Backup restored: ${count} problems.`, "success");
    } catch (err) {
      toast(err.message === "Not a tracker backup" ? "That file isn't a valid tracker backup." : "Couldn't save the backup. Please try again.", "error");
    }
  };

  if (!keyboardBound) {
    keyboardBound = true;
    document.addEventListener("keydown", e => {
      if (e.key === "/" && $("#page-dsa.on") && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
        e.preventDefault();
        $("#lc-q").focus();
      }
    });
  }
}

export function enterTracker() {
  renderTracker();
}

function filteredProblems() {
  const q = view.q.trim().toLowerCase();
  const d = progress();
  const list = PROBLEMS.filter(p => {
    const st = statusOf(p.id), star = !!d.starred[p.id], rank = RANK.get(p.id);
    if (q && !p.title.toLowerCase().includes(q) && !p.topics.some(t => t.toLowerCase().includes(q)) && String(p.id) !== q) return false;
    if (view.diff !== "ALL" && p.difficulty !== view.diff) return false;
    if (view.status === "starred" ? !star : view.status !== "ALL" && st !== view.status) return false;
    if (view.topics.size && !p.topics.some(t => view.topics.has(t))) return false;
    switch (view.preset) {
      case "top50": return rank < 50;
      case "top100": return rank < 100;
      case "blind75": return BLIND_75.has(p.title);
      case "dp": return p.topics.includes("Dynamic Programming");
      case "graphs": return p.topics.some(t => GRAPH_TOPICS.includes(t));
      case "window": return p.topics.some(t => t === "Sliding Window" || t === "Two Pointers");
      case "starred": return star;
      case "notes": return !!d.notes[p.id];
    }
    return true;
  });

  const key = { freq: p => p.frequency, acc: p => p.acceptanceRate, diff: p => DIFF_WEIGHT[p.difficulty], title: p => p.title }[view.sort];
  return list.sort((a, b) => {
    const x = key(a), y = key(b);
    const c = typeof x === "string" ? x.localeCompare(y) : x - y;
    return c * view.dir || RANK.get(a.id) - RANK.get(b.id);
  });
}

// full=false skips re-rendering filter chrome (topics, presets, active filters)
export function renderTracker(full = true) {
  if (!$("#lc-body")) return;
  const d = progress();
  const list = filteredProblems(), pages = Math.max(1, Math.ceil(list.length / view.size));
  if (view.page > pages) view.page = pages;
  const rows = list.slice((view.page - 1) * view.size, view.page * view.size);

  $("#lc-body").innerHTML = rows.length ? rows.map(p => {
    const st = statusOf(p.id), star = !!d.starred[p.id], note = !!d.notes[p.id];
    return `<div class="lc-row" data-id="${p.id}">
      <span><button class="st ${st}" data-a="status" title="${STATUS_LABEL[st]} · click to change">${STATUS_ICON[st]}</button></span>
      <a class="p-title" href="${p.link}" target="_blank" rel="noopener" title="${esc(p.topics.join(", "))}"><span class="n">${p.id}.</span> ${esc(p.title)}</a>
      <span class="cell-num c-acc">${p.acceptanceRate.toFixed(1)}%</span>
      <span class="diff ${p.difficulty}">${p.difficulty === "MEDIUM" ? "Med." : diffName(p.difficulty)}</span>
      <span class="freq c-freq" title="Frequency ${p.frequency.toFixed(1)}"><span class="bar"><i style="width:${Math.min(100, p.frequency)}%"></i></span><span>${Math.round(p.frequency)}</span></span>
      <span class="acts">
        <button class="act ${star ? "starred" : ""}" data-a="star" title="${star ? "Unstar" : "Star"}">${STAR_SVG}</button>
        <button class="act ${note ? "noted" : ""}" data-a="note" title="Notes & confidence">${NOTE_SVG}</button>
      </span>
    </div>`;
  }).join("") : `<div class="lc-empty">No problems match these filters.</div>`;

  $("#lc-count").textContent = list.length
    ? `${(view.page - 1) * view.size + 1}–${Math.min(view.page * view.size, list.length)} of ${list.length}`
    : "0 problems";
  renderPager(pages);
  $$(".lc-head [data-sort]").forEach(b => {
    const on = b.dataset.sort === view.sort;
    b.classList.toggle("on", on);
    b.textContent = b.textContent.replace(/[↑↓]/g, "").trim() + (on ? (view.dir > 0 ? " ↑" : " ↓") : "");
  });
  renderSidebar();
  if (full) renderFilters();
}

function renderFilters() {
  const shown = view.allTopics ? TOPIC_COUNTS : TOPIC_COUNTS.slice(0, 14);
  $("#lc-topics").innerHTML = shown.map(([t, n]) => `<button class="chip-t ${view.topics.has(t) ? "on" : ""}" data-t="${esc(t)}">${esc(t)}<em>${n}</em></button>`).join("")
    + `<button class="chip-t more" id="lc-more">${view.allTopics ? "Show less" : `All ${TOPIC_COUNTS.length} topics`}</button>`;
  $$("#lc-topics [data-t]").forEach(b => b.onclick = () => {
    const t = b.dataset.t;
    view.topics.has(t) ? view.topics.delete(t) : view.topics.add(t);
    view.page = 1;
    renderTracker();
  });
  $("#lc-more").onclick = () => { view.allTopics = !view.allTopics; renderTracker(); };
  $$("#lc-presets .preset").forEach(b => b.classList.toggle("on", b.dataset.p === view.preset));

  const active = [];
  if (view.q) active.push([`“${view.q}”`, () => { view.q = ""; $("#lc-q").value = ""; }]);
  if (view.diff !== "ALL") active.push([diffName(view.diff), () => { view.diff = "ALL"; $("#lc-diff").value = "ALL"; }]);
  if (view.status !== "ALL") active.push([view.status === "starred" ? "Starred" : STATUS_LABEL[view.status], () => { view.status = "ALL"; $("#lc-status").value = "ALL"; }]);
  view.topics.forEach(t => active.push([t, () => view.topics.delete(t)]));

  $("#lc-active").innerHTML = active.map(([l], i) => `<span class="af">${esc(l)}<button data-i="${i}" title="Remove">✕</button></span>`).join("")
    + (active.length > 1 ? `<button class="btn btn-sm" id="lc-clear">Clear all</button>` : "");
  $$("#lc-active .af button").forEach(b => b.onclick = () => { active[+b.dataset.i][1](); view.page = 1; renderTracker(); });
  if ($("#lc-clear")) $("#lc-clear").onclick = () => { active.forEach(([, clear]) => clear()); view.page = 1; renderTracker(); };
}

function renderPager(pages) {
  const el = $("#lc-pager");
  if (pages <= 1) { el.innerHTML = ""; return; }
  const nums = [1];
  if (view.page > 3) nums.push("…");
  for (let i = Math.max(2, view.page - 1); i <= Math.min(pages - 1, view.page + 1); i++) nums.push(i);
  if (view.page < pages - 2) nums.push("…");
  nums.push(pages);
  el.innerHTML = `<button data-go="${view.page - 1}" ${view.page === 1 ? "disabled" : ""}>‹</button>`
    + nums.map(n => n === "…" ? `<span style="padding:0 4px">…</span>` : `<button data-go="${n}" class="${n === view.page ? "on" : ""}">${n}</button>`).join("")
    + `<button data-go="${view.page + 1}" ${view.page === pages ? "disabled" : ""}>›</button>`;
  $$("button", el).forEach(b => b.onclick = () => {
    view.page = +b.dataset.go;
    renderTracker(false);
    $("#lc-topics").scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function renderSidebar() {
  const d = progress();
  const by = { EASY: [0, 0], MEDIUM: [0, 0], HARD: [0, 0] };
  let solved = 0, attempting = 0;
  for (const p of PROBLEMS) {
    const st = d.solved[p.id];
    by[p.difficulty][1]++;
    if (st === "completed") { solved++; by[p.difficulty][0]++; }
    if (st === "in_progress") attempting++;
  }
  const { streak, solvedToday } = streakInfo();

  // Three arcs, one per difficulty, each sized by its share of the full list
  const C = 2 * Math.PI * 48, total = PROBLEMS.length || 1, GAP = 3;
  let offset = 0;
  const arcs = [["EASY", "--easy"], ["MEDIUM", "--medium"], ["HARD", "--hard"]].map(([k, c]) => {
    const seg = by[k][1] / total * C, done = by[k][0] / total * C;
    const svg = `<circle cx="56" cy="56" r="48" stroke="var(${c})" stroke-opacity=".18" stroke-dasharray="${Math.max(0, seg - GAP)} ${C}" stroke-dashoffset="${-offset}"/>`
      + (done ? `<circle cx="56" cy="56" r="48" stroke="var(${c})" stroke-dasharray="${Math.max(0.01, Math.min(done, seg - GAP))} ${C}" stroke-dashoffset="${-offset}"/>` : "");
    offset += seg;
    return svg;
  }).join("");

  $("#lc-progress").innerHTML = `
    <div class="card-head" style="margin-bottom:12px"><h3>Progress</h3>
      <small title="${solvedToday ? "Solved today" : "Solve one today to keep it"}">🔥 ${streak}-day streak</small></div>
    <div class="ring-wrap">
      <div class="ring"><svg viewBox="0 0 112 112">${arcs}</svg>
        <div class="ring-c"><div><b>${solved}</b><span>/ ${PROBLEMS.length} solved</span></div></div></div>
      <div class="tiles">${["EASY", "MEDIUM", "HARD"].map(k => `<div class="tile"><span class="diff ${k}">${diffName(k)}</span><b>${by[k][0]}<small>/${by[k][1]}</small></b></div>`).join("")}</div>
    </div>
    <div class="side-meta"><span>Attempting <b>${attempting}</b></span><span>Starred <b>${Object.keys(d.starred).length}</b></span><span>Notes <b>${Object.keys(d.notes).length}</b></span></div>`;

  // Daily pick: stable for the day, drawn from the 200 most frequent unsolved problems
  const pool = PROBLEMS.filter(p => d.solved[p.id] !== "completed").slice(0, 200);
  const now = new Date(), seed = now.getFullYear() * 400 + now.getMonth() * 31 + now.getDate();
  const p = pool[seed % (pool.length || 1)];
  $("#lc-today").innerHTML = `<div class="card-head" style="margin-bottom:8px"><h3>Today's pick</h3><small>${now.toLocaleDateString([], { month: "short", day: "numeric" })}</small></div>`
    + (p ? `<a class="pick-title" href="${p.link}" target="_blank" rel="noopener">${p.id}. ${esc(p.title)}</a>
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:10px;font-size:12.5px"><span class="diff ${p.difficulty}">${diffName(p.difficulty)}</span><span style="color:var(--muted)">Acceptance ${p.acceptanceRate.toFixed(1)}%</span></div>
      <div class="tags">${p.topics.slice(0, 4).map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>`
      : `<div class="empty">Everything solved 🎉</div>`);
}

function openProblem(id) {
  const p = PROBLEMS.find(x => x.id === id);
  if (!p) return;
  const d = progress(), dlg = $("#lc-dialog");
  let status = statusOf(id), star = !!d.starred[id], conf = d.confidence[id] || 0;

  dlg.innerHTML = `
    <div class="m-head">
      <div><h3>${p.id}. ${esc(p.title)}</h3>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:12.5px">
          <span class="diff ${p.difficulty}">${diffName(p.difficulty)}</span>
          <span style="color:var(--muted)">Acceptance ${p.acceptanceRate.toFixed(1)}% · Frequency ${p.frequency.toFixed(1)}</span></div></div>
      <button class="x" data-close title="Close">✕</button>
    </div>
    <div class="m-body">
      <div class="tags">${p.topics.map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>
      <div><div class="m-label">Status</div><div class="segs" id="m-st">${Object.entries(STATUS_LABEL).map(([k, l]) => `<button data-v="${k}">${l}</button>`).join("")}</div></div>
      <div><div class="m-label">Confidence</div><div class="segs" id="m-conf">${CONFIDENCE_LABEL.map((l, i) => `<button data-v="${i + 1}">${l}</button>`).join("")}</div></div>
      <div><div class="m-label">Notes</div><textarea class="m-notes" maxlength="${LIMITS.problemNote}" placeholder="Approach, edge cases, time & space complexity…">${esc(d.notes[id] || "")}</textarea></div>
    </div>
    <div class="m-foot">
      <div style="display:flex;gap:8px">
        <a class="btn" href="${p.link}" target="_blank" rel="noopener">Solve on LeetCode ↗</a>
        <button class="btn" id="m-star"></button>
      </div>
      <div style="display:flex;gap:8px"><button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="m-save">Save</button></div>
    </div>`;

  const sync = () => {
    $$("#m-st button", dlg).forEach(b => b.classList.toggle("on", b.dataset.v === status));
    $$("#m-conf button", dlg).forEach(b => b.classList.toggle("on", +b.dataset.v === conf));
    $("#m-star", dlg).textContent = star ? "★ Starred" : "☆ Star";
  };
  $$("#m-st button", dlg).forEach(b => b.onclick = () => { status = b.dataset.v; sync(); });
  $$("#m-conf button", dlg).forEach(b => b.onclick = () => { conf = conf === +b.dataset.v ? 0 : +b.dataset.v; sync(); });
  $("#m-star", dlg).onclick = () => { star = !star; sync(); };
  $$("[data-close]", dlg).forEach(b => b.onclick = () => dlg.close());
  dlg.onclick = e => { if (e.target === dlg) dlg.close(); };
  $("#m-save", dlg).onclick = () => {
    if (status !== statusOf(id)) setStatus(id, status);
    setStarred(id, star);
    setConfidence(id, conf);
    setNote(id, $(".m-notes", dlg).value);
    dlg.close();
    renderTracker(false);
  };

  sync();
  dlg.showModal();
}
