// Supabase-backed persistence. Row Level Security restricts every query to the caller's rows;
// user_id is still sent explicitly so inserts are unambiguous and checked by the policy.

import { supabase } from "./supabase.js";
import { currentUser } from "./session.js";

const CHUNK = 500;
const chunks = list => Array.from({ length: Math.ceil(list.length / CHUNK) }, (_, i) => list.slice(i * CHUNK, (i + 1) * CHUNK));

async function check(promise) {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

export const progressRepository = {
  load: () => check(
    supabase.from("problem_progress").select("problem_id, status, starred, note, confidence, solved_at, updated_at")
  ),
  async save(rows) {
    const uid = currentUser().id;
    for (const part of chunks(rows)) {
      await check(supabase.from("problem_progress").upsert(part.map(r => ({ ...r, user_id: uid })), { onConflict: "user_id,problem_id" }));
    }
  },
  remove: ids => check(supabase.from("problem_progress").delete().in("problem_id", ids))
};

export const notepadRepository = {
  load: () => check(supabase.from("notepads").select("section, body, sketch, links, updated_at")),
  save: row => check(
    supabase.from("notepads").upsert({ ...row, user_id: currentUser().id }, { onConflict: "user_id,section" })
  )
};
