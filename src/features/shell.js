// App shell: sidebar navigation, top bar and the page containers for each track.

import { $, $$, esc } from "../lib/dom.js";
import { SECTIONS, ICONS } from "../config/sections.js";
import { currentUser, userPrefs } from "../services/session.js";
import { registerRoute, onNavigate } from "../router.js";
import { renderDashboard } from "./dashboard.js";
import { trackerHTML, initTracker, enterTracker } from "./tracker.js";
import { notepadHTML, initNotepad, refreshNotepad } from "./notepad.js";

const navButton = (id, name) => `<button data-id="${id}"><svg viewBox="0 0 24 24">${ICONS[id]}</svg>${name}</button>`;
const hostOf = url => new URL(url).hostname.replace(/^www\./, "");

function sectionPage(s) {
  const resources = s.links.length ? `
    <div class="section-title">Resources</div>
    <div class="resources">${s.links.map(([title, url, desc]) => `
      <a class="resource" href="${url}" target="_blank" rel="noopener">
        <div class="res-icon">${esc(title[0])}</div>
        <div><b>${esc(title)}</b><span>${esc(desc)}</span><span class="host">${esc(hostOf(url))}</span></div>
      </a>`).join("")}</div>` : "";

  return `<div class="page" id="page-${s.id}">
    ${s.id === "dsa" ? trackerHTML() : ""}
    ${resources}
    <div class="section-title">Notepad</div>
    ${notepadHTML(s.id)}
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
