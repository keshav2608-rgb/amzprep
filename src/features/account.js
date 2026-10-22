// Account dialog: data export, sign out everywhere, permanent account deletion.

import { $, download } from "../lib/dom.js";
import { toast } from "../lib/toast.js";
import { currentUser, logOut, deleteAccount } from "../services/session.js";
import { exportProgress } from "../services/progress.js";
import { allNotepads } from "../services/notepads.js";

const CONFIRM_WORD = "DELETE";

export function initAccountDialog({ onSignedOut }) {
  const dlg = $("#account-dialog");

  $("#open-account").onclick = () => {
    const u = currentUser();
    $("#acct-name").textContent = u.name;
    $("#acct-email").textContent = u.email;
    $("#acct-confirm").value = "";
    $("#acct-delete").disabled = true;
    dlg.showModal();
  };
  $$close(dlg);

  // Data portability: everything stored for this account, as JSON
  $("#acct-export").onclick = () => {
    const payload = { exportedAt: new Date().toISOString(), account: { email: currentUser().email, name: currentUser().name },
      progress: exportProgress().userData, notepads: allNotepads() };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    download(`amzprep-export-${new Date().toISOString().slice(0, 10)}.json`, url);
    URL.revokeObjectURL(url);
  };

  $("#acct-signout-all").onclick = async () => {
    await logOut({ everywhere: true });
    dlg.close();
    onSignedOut();
  };

  $("#acct-confirm").oninput = e => { $("#acct-delete").disabled = e.target.value.trim() !== CONFIRM_WORD; };
  $("#acct-delete").onclick = async () => {
    const btn = $("#acct-delete");
    btn.disabled = true;
    try {
      await deleteAccount();
      dlg.close();
      onSignedOut();
      toast("Your account and all its data were deleted.", "success");
    } catch (err) {
      toast(err.message, "error");
      btn.disabled = false;
    }
  };
}

function $$close(dlg) {
  dlg.querySelectorAll("[data-close]").forEach(b => b.onclick = () => dlg.close());
  dlg.onclick = e => { if (e.target === dlg) dlg.close(); };
}
