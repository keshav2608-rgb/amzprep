// Run with: npm test
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as P from "../src/services/progress.js";

const ago = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d.toISOString(); };
const VALID = new Set(Array.from({ length: 100 }, (_, i) => i + 1));

// In-memory stand-in for the Supabase repository
function memoryRepo(rows = []) {
  const store = new Map(rows.map(r => [r.problem_id, r]));
  return {
    store,
    load: async () => [...store.values()],
    save: async list => list.forEach(r => store.set(r.problem_id, r)),
    remove: async ids => ids.forEach(id => store.delete(id))
  };
}

let repo;
beforeEach(async () => {
  repo = memoryRepo();
  P.useProgressRepository(repo);
  await P.loadProgress();
});

test("marking a problem solved records when it was solved", () => {
  P.setStatus(1, "completed");
  assert.ok(P.progress().solvedAt[1]);
  assert.deepEqual(P.streakInfo(), { streak: 1, solvedToday: true });
});

test("un-solving a problem removes it from the streak", () => {
  P.setStatus(1, "completed");
  P.setStatus(1, "in_progress");
  assert.equal(P.progress().solvedAt[1], undefined);
  assert.equal(P.streakInfo().streak, 0);
});

test("only solves count toward the streak, not other activity", () => {
  P.setStatus(1, "in_progress");
  P.setNote(2, "an idea");
  P.setConfidence(3, 2);
  assert.equal(P.streakInfo().streak, 0);
  assert.equal(P.solvesByDay().size, 0);
});

test("streak counts consecutive solve days and survives until today ends", async () => {
  P.useProgressRepository(memoryRepo([1, 2, 3, 5].map(n => ({ problem_id: n, status: "completed", solved_at: ago(n) }))));
  await P.loadProgress();
  assert.deepEqual(P.streakInfo(), { streak: 3, solvedToday: false });

  P.setStatus(9, "completed");
  assert.deepEqual(P.streakInfo(), { streak: 4, solvedToday: true });
});

test("a gap of a full day breaks the streak", async () => {
  P.useProgressRepository(memoryRepo([{ problem_id: 1, status: "completed", solved_at: ago(2) }]));
  await P.loadProgress();
  assert.equal(P.streakInfo().streak, 0);
});

test("changes are coalesced and persisted; cleared problems are deleted", async () => {
  P.cycleStatus(4); P.cycleStatus(4);          // todo -> in_progress -> completed
  P.flushProgress();
  await new Promise(r => setImmediate(r));
  const row = repo.store.get(4);
  assert.equal(row.status, "completed");
  assert.ok(row.solved_at, "a solved row always carries solved_at (DB constraint)");

  P.setStatus(4, "todo");
  P.flushProgress();
  await new Promise(r => setImmediate(r));
  assert.equal(repo.store.has(4), false);
});

test("notes are length-limited", () => {
  P.setNote(5, "x".repeat(20000));
  assert.equal(P.progress().notes[5].length, 10000);
});

test("backup import keeps only valid ids and values", () => {
  const out = P.sanitizeBackup({
    solved: { 1: "completed", 2: "bogus", 9999: "completed" },
    starred: { 1: true, 3: "yes" },
    notes: { 1: "ok", 4: 42 },
    confidence: { 1: 9, 2: 3 },
    lastUpdated: { 1: ago(1) }
  }, VALID);
  assert.deepEqual(out.solved, { 1: "completed" });
  assert.deepEqual(out.starred, { 1: true });
  assert.deepEqual(out.notes, { 1: "ok" });
  assert.deepEqual(out.confidence, { 2: 3 });
  assert.equal(out.solvedAt[1], ago(1), "old backups fall back to lastUpdated for the solve date");
});

test("backup import rejects files that aren't backups", () => {
  assert.throws(() => P.sanitizeBackup({ hello: 1 }, VALID), /Not a tracker backup/);
  assert.throws(() => P.sanitizeBackup(null, VALID), /Not a tracker backup/);
});
