// Authentication via Supabase Auth (email + password, email confirmation, password reset).
// Error messages are deliberately generic so they don't reveal whether an email is registered.

import { supabase } from "./supabase.js";
import { storage } from "../lib/storage.js";
import { LIMITS, isEmail, passwordProblem, clamp } from "../lib/validate.js";

let current = null; // { id, email, name }

export const currentUser = () => current;

function setUser(user) {
  current = user
    ? { id: user.id, email: user.email, name: user.user_metadata?.display_name || user.email.split("@")[0] }
    : null;
  return current;
}

// Non-sensitive UI preferences (e.g. last open tab), kept per user in this browser only
const prefKey = k => `prep:u:${current.id}:${k}`;
export const userPrefs = {
  get: (k, fallback) => storage.get(prefKey(k), fallback),
  set: (k, v) => storage.set(prefKey(k), v)
};

export class AuthError extends Error {}

function friendly(error, fallback) {
  const msg = (error?.message || "").toLowerCase();
  if (error?.status === 429 || msg.includes("rate limit")) return "Too many attempts. Please wait a few minutes and try again.";
  if (msg.includes("email not confirmed")) return "Please confirm your email first. Check your inbox for the link.";
  if (msg.includes("weak") || msg.includes("pwned") || msg.includes("leaked")) return "That password is too weak or appeared in a data breach. Please choose another.";
  return fallback;
}

const redirectUrl = (params = "") => `${window.location.origin}/${params}`;

export async function restoreSession() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return setUser(null);
  // Verify the token with the server so revoked or expired sessions are rejected
  const { data: verified, error } = await supabase.auth.getUser();
  if (error && error.status >= 400 && error.status < 500) {
    await supabase.auth.signOut({ scope: "local" });
    return setUser(null);
  }
  return setUser(verified?.user || data.session.user);
}

export function onAuthChange(callback) {
  supabase.auth.onAuthStateChange((event, session) => {
    // Defer so callbacks can safely call other supabase methods
    setTimeout(() => callback(event, setUser(session?.user)), 0);
  });
}

export async function signUp({ name, email, password, confirm }) {
  email = email.trim().toLowerCase();
  if (!isEmail(email)) throw new AuthError("Enter a valid email address.");
  const weak = passwordProblem(password);
  if (weak) throw new AuthError(weak);
  if (password !== confirm) throw new AuthError("Passwords don't match.");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: clamp(name.trim(), LIMITS.displayName) }, emailRedirectTo: redirectUrl() }
  });
  if (error) throw new AuthError(friendly(error, "Couldn't create the account. Please try again."));
  // With email confirmation on (recommended), there's no session until the link is clicked
  return data.session ? { user: setUser(data.user) } : { needsConfirmation: true };
}

export async function logIn({ email, password }) {
  email = email.trim().toLowerCase();
  if (!isEmail(email) || !password) throw new AuthError("Incorrect email or password.");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new AuthError(friendly(error, "Incorrect email or password."));
  return setUser(data.user);
}

export async function requestPasswordReset(email) {
  email = email.trim().toLowerCase();
  if (!isEmail(email)) throw new AuthError("Enter a valid email address.");
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl("?reset=1") });
  // Same response whether or not the account exists (prevents account enumeration)
  if (error?.status === 429) throw new AuthError(friendly(error));
}

export async function updatePassword({ password, confirm }) {
  const weak = passwordProblem(password);
  if (weak) throw new AuthError(weak);
  if (password !== confirm) throw new AuthError("Passwords don't match.");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new AuthError(friendly(error, "Couldn't update the password. The reset link may have expired."));
}

export async function logOut({ everywhere = false } = {}) {
  await supabase.auth.signOut({ scope: everywhere ? "global" : "local" });
  setUser(null);
}

export async function deleteAccount() {
  const { error } = await supabase.rpc("delete_my_account");
  if (error) throw new AuthError("Couldn't delete the account. Please try again.");
  await supabase.auth.signOut({ scope: "local" });
  setUser(null);
}
