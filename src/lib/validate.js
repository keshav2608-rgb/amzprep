// Client-side validation. The database enforces the same limits (see supabase/migrations);
// these exist to give users fast, friendly feedback.

export const LIMITS = {
  displayName: 60,
  email: 254,
  passwordMin: 8,
  passwordMax: 72,          // bcrypt (used by Supabase Auth) ignores bytes beyond 72
  problemNote: 10000,
  notepadBody: 100000,
  sketchChars: 2000000,
  links: 200,
  linkTitle: 200,
  linkUrl: 2048
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isEmail = s => s.length <= LIMITS.email && EMAIL_RE.test(s);

export function passwordProblem(pw) {
  if (pw.length < LIMITS.passwordMin) return `Password must be at least ${LIMITS.passwordMin} characters.`;
  if (pw.length > LIMITS.passwordMax) return `Password must be at most ${LIMITS.passwordMax} characters.`;
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return "Use at least one letter and one number.";
  return null;
}

// Only http(s) URLs may be rendered as links; anything else (javascript:, data:, …) is rejected.
export function safeUrl(input) {
  let s = String(input || "").trim();
  if (!s || s.length > LIMITS.linkUrl) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = "https://" + s;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

export const clamp = (s, max) => String(s ?? "").slice(0, max);
