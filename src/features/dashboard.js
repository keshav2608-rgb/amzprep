// Dashboard: today's streak and next problem first, then progress analytics.

import { $, $$, esc } from "../lib/dom.js";
import { dayKey, daysAgo } from "../lib/dates.js";
import { PROBLEMS } from "../data/problems.js";
import { SECTIONS } from "../config/sections.js";
import { CONFIDENCE_LABEL } from "../config/tracker.js";
import { progress, solvesByDay, streakInfo, solvedInLastDays } from "../services/progress.js";
import { notepadSummary } from "../services/notepads.js";
import { navigate } from "../router.js";

const HEATMAP_WEEKS = 26;
const DIFFS = [["EASY", "Easy", "--easy"], ["MEDIUM", "Medium", "--medium"], ["HARD", "Hard", "--hard"]];
const diffName = d => d[0] + d.slice(1).toLowerCase();
const fmt = n => n.toLocaleString("en-US");
const plural = (n, one, many = one + "s") => `${fmt(n)} ${n === 1 ? one : many}`;

let firstRender = true;

function computeStats() {
  const d = progress();
  const byDiff = { EASY: [0, 0], MEDIUM: [0, 0], HARD: [0, 0] };
  const topics = new Map();
  let solved = 0, inProgress = 0;

  for (const p of PROBLEMS) {
    const st = d.solved[p.id];
    byDiff[p.difficulty][1]++;
    if (st === "completed") { solved++; byDiff[p.difficulty][0]++; }
    if (st === "in_progress") inProgress++;
    for (const t of p.topics) {
      const e = topics.get(t) || { name: t, total: 0, done: 0 };
      e.total++;
      if (st === "completed") e.done++;
      topics.set(t, e);
    }
  }

  const conf = [0, 0, 0, 0];
  for (const c of Object.values(d.confidence)) if (c >= 1 && c <= 4) conf[c - 1]++;

  const days = solvesByDay();
  return {
    d, solved, inProgress, byDiff, conf, days,
    topicList: [...topics.values()].sort((a, b) => b.total - a.total),
    ...streakInfo(days),
    week: solvedInLastDays(7, days),
    starred: Object.keys(d.starred).length,
    notes: Object.keys(d.notes).length
  };
}

export function renderDashboard() {
  const S = computeStats();

  // Up next: problems you've started first, then the most frequently asked untouched ones
  const next = [
    ...PROBLEMS.filter(p => S.d.solved[p.id] === "in_progress"),
    ...PROBLEMS.filter(p => !S.d.solved[p.id])
  ].slice(0, 6);

  const page = $("#page-dashboard");
  page.classList.toggle("dash-enter", firstRender);
  firstRender = false;

  page.innerHTML = `
    ${todayBand(S, next[0])}
    <div class="grid dash-grid">
      ${progressPanel(S)}
      ${activityPanel(S)}
      ${focusPanel(S)}
      ${coveragePanel(S)}
      ${upNextPanel(S, next.slice(1))}
      ${confidencePanel(S)}
    </div>
    ${notebooks()}`;

  $$("#page-dashboard [data-go]").forEach(b => b.onclick = () => navigate(b.dataset.go));
}

/* ---------- Today band ---------- */

function todayBand(S, nextProblem) {
  const note = S.streak === 0
    ? "Solve a problem today to start a streak."
    : S.solvedToday ? "You've solved today. Nice work." : "Solve one today to keep it going.";

  const week = Array.from({ length: 7 }, (_, i) => {
    const day = daysAgo(6 - i);
    const n = S.days.get(dayKey(day)) || 0;
    const isToday = i === 6;
    const label = day.toLocaleDateString("en-US", { weekday: "short" });
    return `<li class="${n ? "solved" : ""} ${isToday ? "is-today" : ""}" title="${day.toDateString()}: ${plural(n, "problem")} solved">
      <span class="wk-dot">${n ? `<span class="num">${n}</span>` : ""}</span><span class="wk-day">${isToday ? "Today" : label.slice(0, 2)}</span></li>`;
  }).join("");

  return `<section class="today" aria-label="Today">
    <div class="today-streak">
      <div class="streak-num num">${S.streak}</div>
      <div>
        <h3>${S.streak === 1 ? "day" : "days"} in a row</h3>
        <p>${note}</p>
      </div>
    </div>
    <div class="today-week">
      <ol class="week">${week}</ol>
      <p>${plural(S.week, "problem")} solved in the last 7 days</p>
    </div>
    <div class="today-next">
      ${nextProblem ? `
        <p class="today-kicker">${S.d.solved[nextProblem.id] === "in_progress" ? "Continue where you left off" : "Next most-asked problem"}</p>
        <a class="today-title" href="${nextProblem.link}" target="_blank" rel="noopener noreferrer">${nextProblem.id}. ${esc(nextProblem.title)}</a>
        <div class="today-meta"><span class="pill ${nextProblem.difficulty}">${diffName(nextProblem.difficulty)}</span><span>${esc(nextProblem.topics.slice(0, 3).join(", "))}</span></div>
        <div class="today-actions">
          <a class="btn btn-primary" href="${nextProblem.link}" target="_blank" rel="noopener noreferrer">Solve on LeetCode</a>
          <button class="btn btn-quiet" data-go="dsa">Open tracker</button>
        </div>`
      : `<p class="today-kicker">All 1,086 problems solved</p><p class="today-title">Time to review your starred ones.</p>`}
    </div>
  </section>`;
}

/* ---------- Panels ---------- */

function progressPanel(S) {
  const total = PROBLEMS.length;
  const pct = total ? (S.solved / total) * 100 : 0;
  return `<section class="card span-5 progress-panel">
    <div class="card-head"><h3>Progress</h3><small>${pct.toFixed(1)}% of the list</small></div>
    <div class="big-count"><span class="num">${fmt(S.solved)}</span><span>of ${fmt(total)} solved</span></div>
    <div class="bar bar-lg"><i style="width:${pct}%"></i></div>
    <ul class="diff-rows">
      ${DIFFS.map(([k, label, c]) => {
        const [done, all] = S.byDiff[k];
        return `<li>
          <span class="diff-name" style="--c:var(${c})">${label}</span>
          <span class="bar"><i style="width:${all ? done / all * 100 : 0}%;background:var(${c})"></i></span>
          <span class="diff-count num">${done}<small>/${all}</small></span>
        </li>`;
      }).join("")}
    </ul>
    <div class="progress-foot">
      <span><b class="num">${S.inProgress}</b> attempting</span>
      <span><b class="num">${S.starred}</b> starred</span>
      <span><b class="num">${S.notes}</b> with notes</span>
    </div>
  </section>`;
}

function activityPanel(S) {
  const { cells, months } = heatmap(S.days);
  const total = [...S.days.values()].reduce((a, b) => a + b, 0);
  return `<section class="card span-7">
    <div class="card-head"><h3>Problems solved per day</h3><small>${plural(total, "solve")} in the last 6 months</small></div>
    <div class="heat-wrap">
      <div class="heat-days" aria-hidden="true"><span></span><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span></div>
      <div class="heat-main">
        <div class="heat-months" aria-hidden="true" style="grid-template-columns:repeat(${HEATMAP_WEEKS + 1}, minmax(0, 1fr))">${months}</div>
        <div class="heat" role="img" aria-label="Heatmap of problems solved per day">${cells}</div>
      </div>
    </div>
    <div class="heat-legend" aria-hidden="true">Fewer <i></i><i data-l="1"></i><i data-l="2"></i><i data-l="3"></i><i data-l="4"></i> More</div>
  </section>`;
}

function focusPanel(S) {
  // The least-mastered of the 15 most common topics, each with the most-asked unsolved problem
  const focus = S.topicList.slice(0, 15).map(t => ({ ...t, p: t.done / t.total })).sort((a, b) => a.p - b.p).slice(0, 4);
  const firstUnsolved = topic => PROBLEMS.find(p => p.topics.includes(topic) && S.d.solved[p.id] !== "completed");
  return `<section class="card span-5">
    <div class="card-head"><h3>Weakest topics</h3><small>Among the 15 most common</small></div>
    <div class="list">
      ${focus.map(t => {
        const p = firstUnsolved(t.name);
        return `<a class="list-item focus-item" ${p ? `href="${p.link}" target="_blank" rel="noopener noreferrer"` : ""}>
          <span class="focus-pct num">${Math.round(t.p * 100)}<small>%</small></span>
          <span class="li-body">
            <span class="li-title">${esc(t.name)}</span>
            <span class="li-sub">${p ? `Try ${esc(p.title)}` : "All solved"}</span>
          </span>
          ${p ? `<span class="pill ${p.difficulty}">${diffName(p.difficulty)}</span><span class="chev" aria-hidden="true">›</span>` : ""}
        </a>`;
      }).join("")}
    </div>
  </section>`;
}

function coveragePanel(S) {
  return `<section class="card span-7">
    <div class="card-head"><h3>Topic coverage</h3><small>The 8 topics with the most problems</small></div>
    <ul class="coverage">
      ${S.topicList.slice(0, 8).map(t => `<li>
        <span class="cov-name">${esc(t.name)}</span>
        <span class="bar"><i style="width:${t.done / t.total * 100}%"></i></span>
        <span class="cov-count num">${t.done}<small>/${t.total}</small></span>
      </li>`).join("")}
    </ul>
  </section>`;
}

function upNextPanel(S, list) {
  return `<section class="card span-7">
    <div class="card-head"><h3>After that</h3><small>Started problems first, then the most frequently asked</small></div>
    <div class="list">
      ${list.length ? list.map(p => `
        <a class="list-item" href="${p.link}" target="_blank" rel="noopener noreferrer">
          <span class="rank num">${p.id}</span>
          <span class="li-body"><span class="li-title">${esc(p.title)}</span>
            <span class="li-sub">${S.d.solved[p.id] === "in_progress" ? "Started. " : ""}${esc(p.topics.slice(0, 3).join(", "))}</span></span>
          <span class="pill ${p.difficulty}">${diffName(p.difficulty)}</span>
          <span class="chev" aria-hidden="true">›</span>
        </a>`).join("") : `<p class="empty">Nothing left in the queue.</p>`}
    </div>
  </section>`;
}

function confidencePanel(S) {
  const rated = S.conf.reduce((a, b) => a + b, 0);
  const shades = ["var(--hard)", "var(--medium)", "color-mix(in srgb, var(--brand) 55%, var(--surface))", "var(--brand)"];
  return `<section class="card span-5">
    <div class="card-head"><h3>How confident you feel</h3><small>${plural(rated, "problem")} rated</small></div>
    ${rated ? `
      <div class="stack" role="img" aria-label="Confidence ratings">
        ${S.conf.map((c, i) => c ? `<i style="flex:${c};background:${shades[i]}" title="${CONFIDENCE_LABEL[i]}: ${c}"></i>` : "").join("")}
      </div>
      <ul class="stack-legend">
        ${S.conf.map((c, i) => `<li><i style="background:${shades[i]}"></i><span>${CONFIDENCE_LABEL[i]}</span><b class="num">${c}</b></li>`).join("")}
      </ul>
      ${S.conf[0] + S.conf[1] ? `<p class="hint">Revisit the ${plural(S.conf[0] + S.conf[1], "problem")} marked shaky or needing practice before your interview.</p>` : ""}`
      : `<p class="empty">Rate problems from the tracker's notes panel to see where you need more practice.</p>`}
  </section>`;
}

function notebooks() {
  return `<section class="notebooks" aria-label="Notebooks">
    <h3>Notebooks</h3>
    <div class="nb-list">
      ${SECTIONS.map(s => {
        const n = notepadSummary(s.id);
        const parts = [n.words ? plural(n.words, "word") : "Empty", n.links ? plural(n.links, "link") : "", n.sketched ? "sketch" : ""].filter(Boolean);
        return `<button class="nb" data-go="${s.id}"><b>${s.name}</b><span>${parts.join(", ")}</span></button>`;
      }).join("")}
    </div>
  </section>`;
}

// Columns are weeks (Sun–Sat), oldest on the left, ending with the current week
function heatmap(days) {
  const end = daysAgo(0);
  const start = daysAgo(HEATMAP_WEEKS * 7 + end.getDay());
  const max = Math.max(1, ...days.values());
  const cells = [];
  const months = [];
  let col = 0, lastMonth = -1;
  for (const dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
    if (dt.getDay() === 0) {
      col++;
      if (dt.getMonth() !== lastMonth) {
        lastMonth = dt.getMonth();
        months.push(`<span style="grid-column:${col} / span 4">${dt.toLocaleDateString("en-US", { month: "short" })}</span>`);
      }
    }
    const n = days.get(dayKey(dt)) || 0;
    const level = n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4));
    cells.push(`<i data-l="${level}" title="${dt.toDateString()}: ${plural(n, "problem")} solved"></i>`);
  }
  // Drop a month label that would collide with the next one at the left edge
  if (months.length > 1 && /grid-column:1 /.test(months[0]) && /grid-column:[23] /.test(months[1])) months.shift();
  return { cells: cells.join(""), months: months.join("") };
}
