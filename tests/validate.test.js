import { test } from "node:test";
import assert from "node:assert/strict";
import { safeUrl, isEmail, passwordProblem } from "../src/lib/validate.js";
import { updateNotepad, getNotepad } from "../src/services/notepads.js";

test("safeUrl allows http(s) and adds https:// when missing", () => {
  assert.equal(safeUrl("https://leetcode.com/problems/two-sum"), "https://leetcode.com/problems/two-sum");
  assert.equal(safeUrl("example.com/a"), "https://example.com/a");
  assert.equal(safeUrl("http://x.org"), "http://x.org/");
});

test("safeUrl rejects script and data URLs", () => {
  for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<script>", "vbscript:x", "", "   "]) {
    assert.equal(safeUrl(bad), null, bad);
  }
});

test("email and password rules", () => {
  assert.ok(isEmail("a@b.co"));
  assert.ok(!isEmail("not-an-email"));
  assert.match(passwordProblem("short1"), /at least 8/);
  assert.match(passwordProblem("onlyletters"), /letter and one number/);
  assert.equal(passwordProblem("goodpass123"), null);
});

test("notepad links are sanitized before saving", () => {
  updateNotepad("backend", { links: [{ title: "ok", url: "example.com" }, { title: "evil", url: "javascript:alert(1)" }] });
  assert.deepEqual(getNotepad("backend").links, [{ title: "ok", url: "https://example.com/" }]);
});

test("oversized or non-PNG sketches are refused", () => {
  assert.throws(() => updateNotepad("dsa", { sketch: "data:text/html;base64,AAAA" }), /too large/);
  assert.throws(() => updateNotepad("dsa", { sketch: "data:image/png;base64," + "A".repeat(2_100_000) }), /too large/);
});
