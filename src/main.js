// Entry point: wire services, restore the session (or show sign-in), then mount the app.

import { $, $$ } from "./lib/dom.js";
import { toast } from "./lib/toast.js";
import { isConfigured } from "./services/supabase.js";
import { restoreSession, onAuthChange, logOut, userPrefs } from "./services/session.js";
import { progressRepository, notepadRepository } from "./services/repositories.js";
import { useProgressRepository, onProgressSyncError, loadProgress, flushProgress } from "./services/progress.js";
import { useNotepadRepository, onNotepadSyncError, loadNotepads, flushNotepads } from "./services/notepads.js";
import { toggleTheme } from "./services/theme.js";
import { navigate } from "./router.js";
import { initAuthView, showAuth, showConfigError } from "./features/auth-view.js";
import { initAccountDialog } from "./features/account.js";
import { mountShell, unmountShell } from "./features/shell.js";

let mounted = false;
let recovering = new URLSearchParams(window.location.search).has("reset");

async function start() {
  if (mounted) return;
  mounted = true;
  $("#auth").hidden = true;
  $("#boot").hidden = false;
  try {
    await Promise.all([loadProgress(), loadNotepads()]);
  } catch {
    toast("Couldn't load your data. Check your connection and refresh.", "error");
  }
  $("#boot").hidden = true;
  mountShell();
  $$(".nav button").forEach(b => b.onclick = () => navigate(b.dataset.id));
  navigate(userPrefs.get("tab", "dashboard"));
}

function stop(mode = "login", options) {
  mounted = false;
  unmountShell();
  showAuth(mode, options);
}

function main() {
  $("#theme").onclick = toggleTheme;
  if (!isConfigured) return showConfigError();

  useProgressRepository(progressRepository);
  useNotepadRepository(notepadRepository);
  const syncError = () => toast("Couldn't save your last change. Check your connection.", "error");
  onProgressSyncError(syncError);
  onNotepadSyncError(syncError);

  initAuthView({
    onAuthenticated: () => {
      recovering = false;
      start();
    }
  });
  initAccountDialog({ onSignedOut: () => stop() });

  $("#logout").onclick = async () => {
    flushProgress();
    flushNotepads();
    await logOut();
    stop();
  };

  onAuthChange((event, user) => {
    if (event === "PASSWORD_RECOVERY") {
      recovering = true;
      if (mounted) stop("reset"); else showAuth("reset");
    } else if (event === "SIGNED_OUT" && mounted) {
      stop();
    } else if (event === "SIGNED_IN" && user && !recovering) {
      start();
    }
  });

  // Save queued edits if the tab is closed or hidden
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && mounted) { flushProgress(); flushNotepads(); }
  });

  restoreSession().then(user => {
    // Remove one-time auth parameters (?code=…) from the address bar
    if (window.location.search && !recovering) history.replaceState(null, "", window.location.pathname);
    if (user && recovering) showAuth("reset");
    else if (user) start();
    else showAuth();
  }).catch(() => showAuth("login", { message: "Couldn't reach the server. Check your connection and refresh." }));
}

main();
