// Auth screen: log in, sign up, forgot password, and set a new password (after a reset link).

import { $, $$ } from "../lib/dom.js";
import { LIMITS } from "../lib/validate.js";
import { AuthError, signUp, logIn, requestPasswordReset, updatePassword } from "../services/session.js";

const MODES = {
  login:  { title: "Welcome back", sub: "Log in to continue your interview prep.", submit: "Log in", fields: ["email", "pass"] },
  signup: { title: "Create your account", sub: "Track DSA, design and leadership prep in one place.", submit: "Create account", fields: ["name", "email", "pass", "confirm"] },
  forgot: { title: "Reset your password", sub: "We'll email you a link to choose a new one.", submit: "Send reset link", fields: ["email"] },
  reset:  { title: "Choose a new password", sub: "Enter a new password for your account.", submit: "Update password", fields: ["pass", "confirm"] }
};

let mode = "login";
let busy = false;

function setMode(next, { message = "" } = {}) {
  mode = next;
  const m = MODES[mode];
  $$("#auth .seg button").forEach(b => b.classList.toggle("on", b.dataset.mode === mode));
  $("#auth .seg").hidden = mode === "forgot" || mode === "reset";
  for (const f of ["name", "email", "pass", "confirm"]) {
    $(`#f-${f}`).hidden = !m.fields.includes(f);
    $(`#f-${f} input`).required = m.fields.includes(f);
  }
  $("#auth-title").textContent = m.title;
  $("#auth-sub").textContent = m.sub;
  $("#auth-submit").textContent = m.submit;
  $("#auth-form [name=pass]").autocomplete = mode === "login" ? "current-password" : "new-password";
  $("#forgot-link").hidden = mode !== "login";
  $("#back-link").hidden = mode !== "forgot";
  setError("");
  setInfo(message);
}

const setError = msg => { $("#auth-error").textContent = msg; };
const setInfo = msg => { $("#auth-info").textContent = msg; $("#auth-info").hidden = !msg; };

export function initAuthView({ onAuthenticated }) {
  $("#auth-form [name=name]").maxLength = LIMITS.displayName;
  $("#auth-form [name=email]").maxLength = LIMITS.email;
  $$("#auth-form [type=password]").forEach(i => { i.maxLength = LIMITS.passwordMax; });

  $$("#auth .seg button").forEach(b => b.onclick = () => setMode(b.dataset.mode));
  $("#forgot-link").onclick = () => setMode("forgot");
  $("#back-link").onclick = () => setMode("login");

  $("#auth-form").onsubmit = async e => {
    e.preventDefault();
    if (busy) return;
    const f = e.target, field = n => f.elements[n].value;
    const values = { name: field("name"), email: field("email"), password: field("pass"), confirm: field("confirm") };

    busy = true;
    $("#auth-submit").setAttribute("aria-busy", "true");
    setError("");
    try {
      if (mode === "login") {
        const user = await logIn(values);
        f.reset();
        onAuthenticated(user);
      } else if (mode === "signup") {
        const res = await signUp(values);
        f.reset();
        if (res.user) onAuthenticated(res.user);
        else setMode("login", { message: "Check your inbox for a confirmation link, then log in." });
      } else if (mode === "forgot") {
        await requestPasswordReset(values.email);
        f.reset();
        setMode("login", { message: "If an account exists for that email, a reset link is on its way." });
      } else if (mode === "reset") {
        await updatePassword(values);
        f.reset();
        history.replaceState(null, "", window.location.pathname);
        onAuthenticated();
      }
    } catch (err) {
      setError(err instanceof AuthError ? err.message : "Something went wrong. Please try again.");
    } finally {
      busy = false;
      $("#auth-submit").removeAttribute("aria-busy");
    }
  };
}

export function showAuth(initialMode = "login", options) {
  $("#app").hidden = true;
  $("#auth").hidden = false;
  setMode(initialMode, options);
}

export function showConfigError() {
  showAuth();
  $("#auth-form").hidden = true;
  $("#auth .seg").hidden = true;
  $("#auth .auth-links").hidden = true;
  setInfo("Sign-in isn't available yet: this deployment isn't connected to its database. Please try again later.");
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY environment variables.");
}
