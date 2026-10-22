// App shell: sidebar navigation, top bar and the page containers for each track.

import { $, $$, esc } from "../lib/dom.js";
import { SECTIONS, ICONS } from "../config/sections.js";
import { currentUser, userPrefs } from "../services/session.js";
import { registerRoute, onNavigate } from "../router.js";
import { renderDashboard } from "./dashboard.js";
import { trackerHTML, initTracker, enterTracker } from "./tracker.js";
import { notepadHTML, initNotepad, refreshNotepad } from "./notepad.js";

const navButton = (id, name) => `<button data-id="${id}"><svg viewBox="0 0 24 24">${ICONS[id]}</svg>${name}</button>`;
// Readable source label; machine-generated hosts (e.g. CDN buckets) get a generic name
const hostOf = url => {
  const host = new URL(url).hostname.replace(/^www\./, "");
  return /^[a-z0-9]{12,}\./.test(host) ? "Course site" : host;
};

const EXTERNAL_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';

function sectionPage(s) {
  const resources = s.links.length ? `
    <section class="resources-block">
      <h3 class="block-title">Reading list</h3>
      <div class="resources">${s.links.map(([title, url, desc]) => `
        <a class="resource" href="${url}" target="_blank" rel="noopener noreferrer">
          <span class="res-body"><b>${esc(title)}</b><span>${esc(desc)}</span></span>
          <span class="host">${esc(hostOf(url))}${EXTERNAL_ICON}</span>
        </a>`).join("")}</div>
    </section>` : "";

  return `<div class="page" id="page-${s.id}">
    ${s.id === "dsa" ? trackerHTML() : ""}
    <div class="track ${s.links.length ? "" : "track-solo"}">
      ${resources}
      <section class="notebook-block">
        <h3 class="block-title">Notebook</h3>
        ${notepadHTML(s.id)}
      </section>
    </div>
  </div>`;
}

function greeting() {
  const h = new Date().getHours();
  const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return `${part}, ${currentUser().name.split(" ")[0]}`;
}

export function mountShell() {
  const user = currentUser();
  $("#auth").hidden = true;
  $("#app").hidden = false;
  $("#avatar").textContent = (user.name[0] || "?").toUpperCase();
  $("#who-name").textContent = user.name;
  $("#who-user").textContent = user.email;

  $("#nav-main").innerHTML = navButton("dashboard", "Dashboard");
  $("#nav-tracks").innerHTML = SECTIONS.map(s => navButton(s.id, s.name)).join("");
  $("#content").innerHTML = `<div class="page" id="page-dashboard"></div>` + SECTIONS.map(sectionPage).join("");

  SECTIONS.forEach(s => initNotepad(s.id));
  initTracker();

  registerRoute("dashboard", renderDashboard);
  for (const s of SECTIONS) {
    registerRoute(s.id, () => {
      if (s.id === "dsa") enterTracker();
      refreshNotepad(s.id);
    });
  }

  onNavigate(id => {
    $$(".nav button").forEach(b => b.classList.toggle("on", b.dataset.id === id));
    $$(".page").forEach(p => p.classList.toggle("on", p.id === `page-${id}`));
    const s = SECTIONS.find(x => x.id === id);
    $("#page-title").textContent = s ? s.name : "Dashboard";
    $("#page-sub").textContent = s ? s.sub : greeting();
    userPrefs.set("tab", id);
  });
}

export function unmountShell() {
  $("#content").innerHTML = "";
}
