// Notepad content per section, cached in memory and saved to the repository with a debounce.

import { LIMITS, clamp, safeUrl } from "../lib/validate.js";

const SAVE_DELAY_MS = 800;

let repo = null;
let onError = () => {};
const cache = new Map();   // section -> { body, sketch, links }
const pending = new Map(); // section -> { timer, waiters }

export function useNotepadRepository(repository) { repo = repository; }
export function onNotepadSyncError(handler) { onError = handler; }

const blank = () => ({ body: "", sketch: null, links: [] });

export async function loadNotepads() {
  cache.clear();
  const rows = repo ? await repo.load() : [];
  for (const r of rows) {
    // Re-validate stored data too: never trust that what comes back is well-formed
    const links = Array.isArray(r.links) ? sanitize({ links: r.links }).links : [];
    const sketch = typeof r.sketch === "string" && r.sketch.startsWith("data:image/png;base64,") ? r.sketch : null;
    cache.set(r.section, { body: clamp(r.body || "", LIMITS.notepadBody), sketch, links });
  }
}

export const getNotepad = section => cache.get(section) || blank();

// Merge a change and schedule a save. Resolves true when saved, false on failure.
export function updateNotepad(section, patch) {
  const next = { ...getNotepad(section), ...sanitize(patch) };
  cache.set(section, next);

  const entry = pending.get(section) || { waiters: [] };
  clearTimeout(entry.timer);
  const done = new Promise(resolve => entry.waiters.push(resolve));
  entry.timer = setTimeout(() => save(section), SAVE_DELAY_MS);
  pending.set(section, entry);
  return done;
}

async function save(section) {
  const entry = pending.get(section);
  pending.delete(section);
  let ok = true;
  try {
    if (repo) await repo.save({ section, ...getNotepad(section) });
  } catch (err) {
    ok = false;
    onError(err);
  }
  entry?.waiters.forEach(resolve => resolve(ok));
}

export function flushNotepads() {
  for (const [section, entry] of pending) {
    clearTimeout(entry.timer);
    save(section);
  }
}

function sanitize(patch) {
  const out = {};
  if ("body" in patch) out.body = clamp(patch.body, LIMITS.notepadBody);
  if ("sketch" in patch) {
    const s = patch.sketch;
    if (s && (!s.startsWith("data:image/png;base64,") || s.length > LIMITS.sketchChars)) throw new Error("Sketch too large to save");
    out.sketch = s || null;
  }
  if ("links" in patch) {
    out.links = patch.links
      .map(l => ({ title: clamp(l.title, LIMITS.linkTitle), url: safeUrl(l.url) }))
      .filter(l => l.url)
      .slice(0, LIMITS.links);
  }
  return out;
}

export function notepadSummary(section) {
  const { body, sketch, links } = getNotepad(section);
  const text = body.trim();
  return { words: text ? text.split(/\s+/).length : 0, links: links.length, sketched: !!sketch };
}

export const allNotepads = () => Object.fromEntries(cache);
