// Database security tests: apply every migration to an in-memory Postgres (PGlite) with a
// minimal stand-in for Supabase's auth schema, then verify RLS, grants and constraints.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS = join(import.meta.dirname, "..", "supabase", "migrations");
const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
let db;

before(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  for (const file of readdirSync(MIGRATIONS).filter(f => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
  }
  await db.exec(`insert into auth.users (id, raw_user_meta_data) values ('${A}', '{"display_name":"Ada"}'), ('${B}', '{}');`);
});

// Run a statement as a signed-in user (uid) or as anon (uid = null)
async function as(uid, sql) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false); set role ${uid ? "authenticated" : "anon"};`);
  try {
    const r = await db.query(sql);
    return { rows: r.rows, count: r.affectedRows };
  } finally {
    await db.exec("reset role;");
  }
}

test("a profile is created on sign-up and visible only to its owner", async () => {
  const { rows } = await as(A, "select display_name from public.profiles");
  assert.deepEqual(rows, [{ display_name: "Ada" }]);
});

test("users can only read and write their own progress", async () => {
  await as(A, `insert into public.problem_progress (problem_id, status, solved_at) values (1, 'completed', now())`);
  await assert.rejects(as(A, `insert into public.problem_progress (user_id, problem_id, starred) values ('${B}', 2, true)`));
  assert.equal((await as(B, "select * from public.problem_progress")).rows.length, 0);
  assert.equal((await as(B, "update public.problem_progress set note = 'x'")).count, 0);
  assert.equal((await as(B, "delete from public.problem_progress")).count, 0);
  assert.equal((await as(A, "select * from public.problem_progress")).rows.length, 1);
});

test("anonymous visitors have no access to any table", async () => {
  for (const t of ["profiles", "problem_progress", "notepads"]) {
    await assert.rejects(as(null, `select * from public.${t}`), `anon read ${t}`);
  }
  await assert.rejects(as(null, "select public.delete_my_account()"));
});

test("constraints reject malformed progress", async () => {
  const bad = [
    "insert into public.problem_progress (problem_id, status) values (3, 'completed')",                 // solved, no date
    "insert into public.problem_progress (problem_id, status, solved_at) values (4, null, now())",       // date, not solved
    "insert into public.problem_progress (problem_id, status, solved_at) values (4, 'in_progress', now())",
    "insert into public.problem_progress (problem_id, status) values (5, 'hacked')",
    "insert into public.problem_progress (problem_id, confidence) values (6, 9)",
    "insert into public.problem_progress (problem_id, note) values (7, repeat('x', 10001))",
    "insert into public.problem_progress (problem_id, starred) values (0, true)"
  ];
  for (const sql of bad) await assert.rejects(as(A, sql), sql);
});

test("constraints reject malformed notepads", async () => {
  await as(A, "insert into public.notepads (section, body) values ('backend', 'hi')");
  await assert.rejects(as(A, "insert into public.notepads (section) values ('admin')"));
  await assert.rejects(as(A, "insert into public.notepads (section, sketch) values ('dsa', 'data:text/html;base64,AA')"));
  await assert.rejects(as(A, `insert into public.notepads (section, links) values ('dsa', '{"a":1}')`));
});

test("profiles: only the display name can be changed", async () => {
  await assert.rejects(as(A, `update public.profiles set id = '${B}'`));
  assert.equal((await as(A, "update public.profiles set display_name = 'Ada L'")).count, 1);
});

test("deleting an account removes only that user's data, completely", async () => {
  await as(B, "insert into public.notepads (section, body) values ('dsa', 'b')");
  await as(B, "select public.delete_my_account()");
  assert.equal((await as(A, "select * from public.problem_progress")).rows.length, 1, "A unaffected");

  await as(A, "select public.delete_my_account()");
  const { rows } = await db.query(`select (select count(*) from auth.users)::int users, (select count(*) from public.profiles)::int profiles,
    (select count(*) from public.problem_progress)::int progress, (select count(*) from public.notepads)::int notepads`);
  assert.deepEqual(rows[0], { users: 0, profiles: 0, progress: 0, notepads: 0 });
});
