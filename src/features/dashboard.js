// Dashboard: KPIs and analytics derived from DSA progress and notepad usage.

import { $, $$, esc } from "../lib/dom.js";
import { dayKey, daysAgo } from "../lib/dates.js";
import { PROBLEMS } from "../data/problems.js";
import { SECTIONS } from "../config/sections.js";
import { CONFIDENCE_LABEL } from "../config/tracker.js";
import { progress, solvesByDay, streakInfo, solvedInLastDays } from "../services/progress.js";
import { notepadSummary } from "../services/notepads.js";
import { navigate } from "../router.js";

const HEATMAP_WEEKS = 26;
const diffName = d => d[0] + d.slice(1).toLowerCase();

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
  const S = computeStats(), total = PROBLEMS.length || 1;
  const pct = n => Math.round((n / total) * 1000) / 10;

  // Weak spots: the least-mastered of the 15 most common topics
  const focus = S.topicList.slice(0, 15).map(t => ({ ...t, p: t.done / t.total })).sort((a, b) => a.p - b.p).slice(0, 4);
  const firstUnsolved = topic => PROBLEMS.find(p => p.topics.includes(topic) && S.d.solved[p.id] !== "completed");

  // Up next: in-progress first, then the highest-frequency untouched problems
  const next = [
    ...PROBLEMS.filter(p => S.d.solved[p.id] === "in_progress"),
    ...PROBLEMS.filter(p => !S.d.solved[p.id])
  ].slice(0, 5);

  const [e, m, h] = ["EASY", "MEDIUM", "HARD"].map(k => S.byDiff[k][0]);
  const sum = e + m + h;
  const donutBg = sum
    ? `conic-gradient(var(--easy) 0 ${e / sum * 360}deg, var(--medium) 0 ${(e + m) / sum * 360}deg, var(--hard) 0 360deg)`
    : "var(--surface-2)";

  const ws = SECTIONS.map(s => ({ ...s, ...notepadSummary(s.id) }));
  const activePads = ws.filter(w => w.words).length;
  const confMax = Math.max(1, ...S.conf);

  const streakMeta = S.streak === 0
    ? "Solve a problem today to start one"
    : S.solvedToday ? `${S.week} solved in the last 7 days` : "Solve one today to keep it going";

  $("#page-dashboard").innerHTML = `
  <div class="grid">
    ${kpi("Problems solved", `${S.solved}<small> / ${PROBLEMS.length}</small>`, `${pct(S.solved)}% of the list`, pct(S.solved))}
    ${kpi("Solving streak", `${S.streak}<small> day${S.streak === 1 ? "" : "s"}</small>`, streakMeta)}
    ${kpi("In progress", S.inProgress, `${S.starred} starred for revision`)}
    ${kpi("Notes written", S.notes + activePads, `${S.notes} problem notes · ${activePads} notepads`)}

    <div class="card span-7">
      <div class="card-head"><h3>Problems solved per day</h3><small>Last 6 months</small></div>
      <div class="heat">${heatmap(S.days)}</div>
      <div class="heat-legend">Less <i style="background:var(--surface-2)"></i>${[1, 2, 3, 4].map(l => `<i data-l="${l}"></i>`).join("")} More</div>
    </div>

    <div class="card span-5">
      <div class="card-head"><h3>Solved by difficulty</h3><small>${sum} total</small></div>
      <div class="donut-wrap">
        <div class="donut" style="background:${donutBg}"><div class="donut-center"><div><b>${pct(S.solved)}%</b><span>complete</span></div></div></div>
        <div class="legend">
          ${[["EASY", "--easy"], ["MEDIUM", "--medium"], ["HARD", "--hard"]].map(([k, c]) => {
            const [done, all] = S.byDiff[k];
            return `<div>
              <div class="legend-row"><i class="dot" style="background:var(${c})"></i><span>${diffName(k)}</span><span class="num">${done} / ${all}</span></div>
              <div class="bar" style="margin-top:6px"><i style="width:${all ? done / all * 100 : 0}%;background:var(${c})"></i></div>
            </div>`;
          }).join("")}
        </div>
      </div>
    </div>

    <div class="card span-5">
      <div class="card-head"><h3>Focus next</h3><small>Weakest common patterns</small></div>
      <div class="list">
        ${focus.map(t => {
          const p = firstUnsolved(t.name);
          return `<a class="list-item" ${p ? `href="${p.link}" target="_blank" rel="noopener"` : ""}>
            <div class="li-body">
              <div class="row-top" style="margin:0"><b style="font-weight:600">${esc(t.name)}</b><span>${t.done}/${t.total} · ${Math.round(t.p * 100)}%</span></div>
              <div class="li-sub">${p ? `Try: ${esc(p.title)}` : "All solved 🎉"}</div>
            </div>
            ${p ? `<span class="pill ${p.difficulty}">${diffName(p.difficulty)}</span>` : ""}
          </a>`;
        }).join("")}
      </div>
    </div>

    <div class="card span-7">
      <div class="card-head"><h3>Topic mastery</h3><small>Top 8 topics by problem count</small></div>
      <div class="rows">
        ${S.topicList.slice(0, 8).map(t => `
          <div><div class="row-top"><b style="font-weight:500">${esc(t.name)}</b><span>${t.done} / ${t.total}</span></div>
          <div class="bar"><i style="width:${t.done / t.total * 100}%"></i></div></div>`).join("")}
      </div>
    </div>

    <div class="card span-7">
      <div class="card-head"><h3>Up next</h3><small>In progress first, then most frequent</small></div>
      <div class="list">
        ${next.length ? next.map(p => `
          <a class="list-item" href="${p.link}" target="_blank" rel="noopener">
            <span class="li-sub" style="width:42px;font-family:var(--mono)">#${p.id}</span>
            <div class="li-body"><div class="li-title">${esc(p.title)}</div>
              <div class="li-sub">${S.d.solved[p.id] === "in_progress" ? "In progress · " : ""}${esc(p.topics.slice(0, 3).join(" · "))}</div></div>
            <span class="pill ${p.difficulty}">${diffName(p.difficulty)}</span>
            <span class="chev">›</span>
          </a>`).join("") : `<div class="empty">Everything solved. Impressive.</div>`}
      </div>
    </div>

    <div class="card span-5">
      <div class="card-head"><h3>Confidence</h3><small>${S.conf.reduce((a, b) => a + b, 0)} rated</small></div>
      <div class="conf">
        ${S.conf.map((c, i) => `<div><b>${c}</b><span class="col ${i >= 2 ? "hi" : ""}" style="height:${c / confMax * 70}%"></span><small>${CONFIDENCE_LABEL[i]}</small></div>`).join("")}
      </div>
    </div>

    <div class="card span-12">
      <div class="card-head"><h3>Workspaces</h3><small>Notepads across your tracks</small></div>
      <div class="ws">
        ${ws.map(w => `<button data-go="${w.id}"><b>${w.name}</b>
          <span>${w.words} words · ${w.links} link${w.links === 1 ? "" : "s"}${w.sketched ? " · sketch" : ""}</span></button>`).join("")}
      </div>
    </div>
  </div>`;

  $$("#page-dashboard [data-go]").forEach(b => b.onclick = () => navigate(b.dataset.go));
}

function kpi(label, value, meta, barPct) {
  return `<div class="card span-3 kpi"><div class="label">${label}</div><div class="value">${value}</div>
    <div class="meta">${meta}</div>${barPct !== undefined ? `<div class="bar"><i style="width:${barPct}%"></i></div>` : ""}</div>`;
}

// Columns are weeks (Sun–Sat), oldest on the left, ending with the current week
function heatmap(days) {
  const end = daysAgo(0);
  const start = daysAgo(HEATMAP_WEEKS * 7 - 1 + end.getDay());
  const max = Math.max(1, ...days.values());
  const cells = [];
  for (const dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
    const n = days.get(dayKey(dt)) || 0;
    const level = n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4));
    cells.push(`<i data-l="${level}" title="${dt.toDateString()}: ${n} solved"></i>`);
  }
  return cells.join("");
}
