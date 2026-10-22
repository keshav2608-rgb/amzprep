// DSA progress for the signed-in user: status, stars, notes, confidence and solve dates.
//
// In-memory shape used by the UI (compatible with the original tracker's backups):
//   solved:      { [id]: "in_progress" | "completed" }   (absent = to do)
//   starred:     { [id]: true }
//   notes:       { [id]: string }
//   confidence:  { [id]: 1..4 }
//   lastUpdated: { [id]: ISO }   any change to the problem
//   solvedAt:    { [id]: ISO }   when it was marked solved (drives streak + activity)
//
// Persistence goes through a repository (Supabase in the app, in-memory in tests). Writes are
// optimistic and coalesced per problem, so rapid clicks produce a single request.

import { dayKey, daysAgo } from "../lib/dates.js";
import { LIMITS, clamp } from "../lib/validate.js";

const SAVE_DELAY_MS = 400;
const VALID_STATUS = new Set(["in_progress", "completed"]);

const empty = () => ({ solved: {}, starred: {}, notes: {}, confidence: {}, lastUpdated: {}, solvedAt: {} });

let data = empty();
let repo = null;
let onError = () => {};
const pending = new Map(); // problemId -> timeout

export function useProgressRepository(repository) { repo = repository; }
export function onProgressSyncError(handler) { onError = handler; }

/* ---------- Row mapping ---------- */

function fromRows(rows) {
  const d = empty();
  for (const r of rows) {
    const id = r.problem_id;
    if (r.status) d.solved[id] = r.status;
    if (r.starred) d.starred[id] = true;
    if (r.note) d.notes[id] = r.note;
    if (r.confidence) d.confidence[id] = r.confidence;
    if (r.solved_at) d.solvedAt[id] = r.solved_at;
    if (r.updated_at) d.lastUpdated[id] = r.updated_at;
  }
  return d;
}

function rowFor(id) {
  return {
    problem_id: id,
    status: data.solved[id] ?? null,
    starred: !!data.starred[id],
    note: data.notes[id] ?? null,
    confidence: data.confidence[id] ?? null,
    solved_at: data.solved[id] === "completed" ? data.solvedAt[id] ?? new Date().toISOString() : null
  };
}

const isEmptyRow = r => !r.status && !r.starred && !r.note && !r.confidence;

/* ---------- Loading & persistence ---------- */

export async function loadProgress() {
  data = fromRows(repo ? await repo.load() : []);
  return data;
}

function persist(id) {
  if (!repo) return;
  clearTimeout(pending.get(id));
  pending.set(id, setTimeout(() => {
    pending.delete(id);
    const row = rowFor(id);
    (isEmptyRow(row) ? repo.remove([id]) : repo.save([row])).catch(err => onError(err));
  }, SAVE_DELAY_MS));
}

// Write any queued changes immediately (e.g. before the page is hidden)
export function flushProgress() {
  for (const [id, timer] of pending) {
    clearTimeout(timer);
    pending.delete(id);
    const row = rowFor(id);
    (isEmptyRow(row) ? repo.remove([id]) : repo.save([row])).catch(err => onError(err));
  }
}

export const progress = () => data;
export const statusOf = id => data.solved[id] || "todo";

const touch = id => { data.lastUpdated[id] = new Date().toISOString(); };

/* ---------- Mutations ---------- */

export function setStatus(id, status) {
  const prev = statusOf(id);
  if (status === "todo") delete data.solved[id];
  else data.solved[id] = status;

  if (status === "completed" && prev !== "completed") data.solvedAt[id] = new Date().toISOString();
  if (status !== "completed") delete data.solvedAt[id];
  touch(id);
  persist(id);
}

export function cycleStatus(id) {
  setStatus(id, { todo: "in_progress", in_progress: "completed", completed: "todo" }[statusOf(id)]);
}

export function setStarred(id, on) {
  if (on) data.starred[id] = true; else delete data.starred[id];
  persist(id);
}

export function setConfidence(id, level) {
  if (level >= 1 && level <= 4) data.confidence[id] = level; else delete data.confidence[id];
  touch(id);
  persist(id);
}

export function setNote(id, text) {
  const t = clamp(text, LIMITS.problemNote).trim();
  if (t) data.notes[id] = t; else delete data.notes[id];
  touch(id);
  persist(id);
}

/* ---------- Backup ---------- */

// Validate an imported backup: keep only known problem ids and well-formed values.
export function sanitizeBackup(raw, validIds) {
  if (!raw || typeof raw !== "object" || typeof raw.solved !== "object") throw new Error("Not a tracker backup");
  const out = empty();
  const ok = id => validIds.has(Number(id));
  for (const [id, st] of Object.entries(raw.solved || {})) if (ok(id) && VALID_STATUS.has(st)) out.solved[id] = st;
  for (const [id, on] of Object.entries(raw.starred || {})) if (ok(id) && on === true) out.starred[id] = true;
  for (const [id, n] of Object.entries(raw.notes || {})) if (ok(id) && typeof n === "string" && n.trim()) out.notes[id] = clamp(n, LIMITS.problemNote);
  for (const [id, c] of Object.entries(raw.confidence || {})) if (ok(id) && Number.isInteger(c) && c >= 1 && c <= 4) out.confidence[id] = c;

  // Solve dates: explicit solvedAt, else the last update (older backups), else now
  const validDate = s => typeof s === "string" && !Number.isNaN(Date.parse(s));
  for (const id of Object.keys(out.solved)) {
    if (out.solved[id] !== "completed") continue;
    const at = raw.solvedAt?.[id] ?? raw.lastUpdated?.[id];
    out.solvedAt[id] = validDate(at) ? new Date(at).toISOString() : new Date().toISOString();
  }
  return out;
}

export async function importProgress(raw, validIds) {
  const incoming = sanitizeBackup(raw, validIds);
  const ids = new Set([...Object.keys(incoming.solved), ...Object.keys(incoming.starred), ...Object.keys(incoming.notes), ...Object.keys(incoming.confidence)].map(Number));
  for (const key of Object.keys(incoming)) Object.assign(data[key], incoming[key]);
  const now = new Date().toISOString();
  ids.forEach(id => { data.lastUpdated[id] = now; });
  if (repo && ids.size) await repo.save([...ids].map(rowFor));
  return ids.size;
}

export const exportProgress = () => ({ exportDate: new Date().toISOString(), version: "2.0", userData: data });

/* ---------- Activity (solves only) ---------- */

// Map of dayKey -> number of problems marked solved that day
export function solvesByDay() {
  const days = new Map();
  for (const ts of Object.values(data.solvedAt)) {
    const k = dayKey(ts);
    days.set(k, (days.get(k) || 0) + 1);
  }
  return days;
}

// Consecutive days with at least one solve, ending today — or yesterday, so the streak
// isn't shown as broken before you've had a chance to solve something today.
export function streakInfo(days = solvesByDay()) {
  const solvedToday = days.has(dayKey(daysAgo(0)));
  let n = 0;
  for (let i = solvedToday ? 0 : 1; days.has(dayKey(daysAgo(i))); i++) n++;
  return { streak: n, solvedToday };
}

export function solvedInLastDays(n, days = solvesByDay()) {
  let total = 0;
  for (let i = 0; i < n; i++) total += days.get(dayKey(daysAgo(i))) || 0;
  return total;
}
