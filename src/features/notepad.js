// Per-section notepad with three modes: Write (text), Sketch (canvas), Links.
// Everything autosaves to the user's account (see services/notepads.js).

import { $, $$, esc, download } from "../lib/dom.js";
import { LIMITS, safeUrl } from "../lib/validate.js";
import { toast } from "../lib/toast.js";
import { getNotepad, updateNotepad } from "../services/notepads.js";

const COLORS = ["#18181b", "#4f46e5", "#dc2626", "#16a34a", "#d97706"];

export function notepadHTML(id) {
  return `<div class="card pad" id="pad-${id}">
    <div class="pad-head">
      <div class="tabs">
        <button data-mode="type" class="on">Write</button>
        <button data-mode="draw">Sketch</button>
        <button data-mode="links">Links</button>
      </div>
      <span class="saved-at"></span>
    </div>
    <div data-pane="type"><textarea class="note" maxlength="${LIMITS.notepadBody}" placeholder="Write your notes here. They save as you type."></textarea></div>
    <div data-pane="draw" hidden>
      <div class="tools">
        <button class="btn btn-sm on" data-tool="pen">Pen</button>
        <button class="btn btn-sm" data-tool="eraser">Eraser</button>
        <span class="sep"></span>
        ${COLORS.map((c, i) => `<button class="swatch ${i ? "" : "on"}" data-color="${c}" style="background:${c}" title="${c}"></button>`).join("")}
        <span class="sep"></span>
        <select class="input btn-sm" style="width:auto;padding:5px 8px" aria-label="Brush size"><option value="2">Fine</option><option value="4" selected>Medium</option><option value="9">Bold</option></select>
        <span style="flex:1"></span>
        <button class="btn btn-sm" data-act="clear">Clear</button>
        <button class="btn btn-sm" data-act="save">Download</button>
      </div>
      <canvas></canvas>
    </div>
    <div data-pane="links" hidden>
      <div class="linkrow">
        <input class="input" type="text" maxlength="${LIMITS.linkTitle}" placeholder="Title (optional)">
        <input class="input" type="url" maxlength="${LIMITS.linkUrl}" placeholder="https://…">
        <button class="btn btn-primary" data-act="add">Save link</button>
      </div>
      <div class="list saved-links"></div>
    </div>
  </div>`;
}

export function initNotepad(id) {
  const root = $(`#pad-${id}`), stamp = $(".saved-at", root);
  // Save a patch and reflect the result in the header
  const save = patch => {
    stamp.textContent = "Saving…";
    let done;
    try { done = updateNotepad(id, patch); } catch (err) { stamp.textContent = ""; toast(err.message, "error"); return; }
    done.then(ok => {
      stamp.textContent = ok ? "Saved " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Not saved";
    });
  };

  const sketch = initSketch(id, root, save);
  $$(".tabs button", root).forEach(b => b.onclick = () => {
    $$(".tabs button", root).forEach(x => x.classList.toggle("on", x === b));
    $$("[data-pane]", root).forEach(p => p.hidden = p.dataset.pane !== b.dataset.mode);
    if (b.dataset.mode === "draw") sketch.resize();
  });

  initWrite(id, root, save);
  initLinks(id, root, save);
}

// Re-measure the canvas when a page becomes visible (it has zero size while hidden)
export function refreshNotepad(id) {
  $$(`#pad-${id} .tabs button.on`).forEach(b => b.click());
}

function initWrite(id, root, save) {
  const ta = $("textarea", root);
  ta.value = getNotepad(id).body;
  ta.oninput = () => save({ body: ta.value });
}

function initSketch(id, root, save) {
  const cv = $("canvas", root), ctx = cv.getContext("2d"), size = $("select", root);
  let tool = "pen", color = COLORS[0], drawing = false, last = null, ready = false;

  function resize() {
    const r = cv.getBoundingClientRect();
    if (!r.width) return;
    const snapshot = ready ? cv.toDataURL() : getNotepad(id).sketch;
    ready = true;
    cv.width = r.width; cv.height = r.height;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
    if (snapshot) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0); img.src = snapshot; }
  }

  const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.onpointerdown = e => { drawing = true; last = pos(e); cv.setPointerCapture(e.pointerId); };
  cv.onpointermove = e => {
    if (!drawing) return;
    const p = pos(e);
    ctx.strokeStyle = tool === "eraser" ? "#fff" : color;
    ctx.lineWidth = tool === "eraser" ? size.value * 5 : size.value;
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(...last); ctx.lineTo(...p); ctx.stroke();
    last = p;
  };
  cv.onpointerup = cv.onpointercancel = () => {
    if (!drawing) return;
    drawing = false;
    save({ sketch: cv.toDataURL("image/png") });
  };

  const selectTool = t => { tool = t; $$("[data-tool]", root).forEach(x => x.classList.toggle("on", x.dataset.tool === t)); };
  $$("[data-tool]", root).forEach(b => b.onclick = () => selectTool(b.dataset.tool));
  $$("[data-color]", root).forEach(b => b.onclick = () => {
    color = b.dataset.color;
    $$("[data-color]", root).forEach(x => x.classList.toggle("on", x === b));
    selectTool("pen");
  });
  $("[data-act=clear]", root).onclick = () => {
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
    save({ sketch: null });
  };
  $("[data-act=save]", root).onclick = () => download(`${id}-sketch.png`, cv.toDataURL());

  return { resize };
}

function initLinks(id, root, save) {
  const [titleIn, urlIn] = $$(".linkrow input", root), list = $(".saved-links", root);
  const links = [...getNotepad(id).links];
  const persist = () => { save({ links }); render(); };

  function render() {
    list.innerHTML = links.length ? links.map((l, i) => {
      let host = l.url;
      try { host = new URL(l.url).hostname.replace(/^www\./, ""); } catch {}
      return `<div class="list-item">
        <div class="li-body"><a class="li-title" style="display:block;text-decoration:none" href="${esc(safeUrl(l.url) || "#")}" target="_blank" rel="noopener noreferrer">${esc(l.title || l.url)}</a>
          <div class="li-sub">${esc(host)}</div></div>
        <button class="x" data-i="${i}" title="Remove link" aria-label="Remove link">✕</button></div>`;
    }).join("") : `<div class="empty">No links yet. Paste a URL above to save one.</div>`;
    $$(".x", list).forEach(b => b.onclick = () => { links.splice(+b.dataset.i, 1); persist(); });
  }

  const add = () => {
    if (!urlIn.value.trim()) return urlIn.focus();
    const url = safeUrl(urlIn.value);
    if (!url) return toast("Only http(s) links can be saved.", "error");
    if (links.length >= LIMITS.links) return toast(`You can save up to ${LIMITS.links} links per notepad.`, "error");
    links.unshift({ title: titleIn.value.trim().slice(0, LIMITS.linkTitle), url });
    titleIn.value = urlIn.value = "";
    persist();
  };
  $("[data-act=add]", root).onclick = add;
  urlIn.onkeydown = e => { if (e.key === "Enter") add(); };
  render();
}
