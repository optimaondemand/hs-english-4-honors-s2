/* Optima project lessons: shared engine (all 9-12 ELA project series).
   Generalized from the English IV Honors "Into the World" engine (itw.js).
   Markup contract:
   <body data-ns="eng1.gawain" data-lesson="L1" data-title="Lesson 1: ..." data-course="English 1"
         data-project-name="The Gawain Disputatio" data-assignment="Module 2 Project" data-code="ELA9">
     data-ns keeps every project's saved answers apart on the same site.
   .tab-bar > button.tab-btn[data-tab]      .tab-panel#tab-<id>      button.tab-next[data-next]
   .answer[data-key][data-label]            (textarea | input | select) autosaves under opt.<ns>.<lesson>.<key>
   .answer[data-project="<name>"]           also saves to opt.<ns>.project.<name> (carried lesson to lesson)
   .answer[data-seed-from="L2.key"]         starts from an earlier lesson's answer until the student edits it
   .choices[data-key] > button.choice[data-value][data-fb]      pick one (optional data-project)
   .chips[data-key] > button.chip[data-value]                   pick several, stored as "a | b"
   .stance-cards[data-key] > .stance-card[data-value]           pick one large card (optional data-project)
   .check > .check-row > .opts > button.opt[data-correct][data-fb]   ungraded quick check, instant feedback
   .mode-grid[data-key]                     renders window.PROJECT_MODES [{id,name,desc}] -> project "medium"
   .seeds[data-fill="<key>"] > button.seed  click a seed to fill that answer
   [data-project-text="<name>"]             shows a saved project value
   .project-strip[data-fields="side,thesis"] with window.PROJECT_LABELS {side:"Your side"} for labels
   .carry[data-from="L3.key|L2.key"][data-k="Label"]  shows the first saved answer from earlier lessons of this project
   [data-show-mode="a,b"]                   shown only when the saved medium matches
   #gathered, [data-action="copy|pdf"], .turn-in-item, .reset-btn
   Weekly checkpoint: button[data-action="pdf"][data-tabs="t1,t2"][data-pdf-title="Quick Write 1: ..."]
     prints only those tabs' answers under that title; status shows in the nearest .gstatus (else #gstatus).
*/
(function () {
  "use strict";
  var body = document.body;
  var NSID = body.getAttribute("data-ns") || "project";
  var LESSON = body.getAttribute("data-lesson") || "L0";
  var TITLE = body.getAttribute("data-title") || "Project lesson";
  var COURSE = body.getAttribute("data-course") || "";
  var PNAME = body.getAttribute("data-project-name") || "";
  var ASSIGN = body.getAttribute("data-assignment") || "";
  var CODE = body.getAttribute("data-code") || "ELA";
  var ROOT = "opt." + NSID + ".";
  var NS = ROOT + LESSON + ".";
  var PNS = ROOT + "project.";
  var MODES = window.PROJECT_MODES || [];
  var LABELS = window.PROJECT_LABELS || {};

  /* ---------- storage ---------- */
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { if (v === "" || v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function project(name) { return get(PNS + name) || ""; }
  function setProject(name, v) { set(PNS + name, v); renderProject(); }
  function modeById(id) { for (var i = 0; i < MODES.length; i++) if (MODES[i].id === id) return MODES[i]; return null; }
  function projectValue(f) {
    if (f === "medium") { var m = modeById(project("medium")); return m ? m.name : ""; }
    var v = project(f);
    var lab = document.querySelector('[data-project="' + f + '"] [data-value="' + v.replace(/"/g, '\\"') + '"] .sc-t');
    return lab ? lab.textContent.trim() : v;
  }

  /* ---------- tabs + progress ---------- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".tab-btn"));
  function switchTab(id) {
    document.querySelectorAll(".tab-panel").forEach(function (p) { p.classList.remove("active"); });
    tabs.forEach(function (b) { b.classList.remove("active"); });
    var panel = document.getElementById("tab-" + id); if (panel) panel.classList.add("active");
    var btn = document.querySelector('.tab-btn[data-tab="' + id + '"]');
    if (btn) { btn.classList.add("active"); btn.classList.add("visited"); set(NS + "visited." + id, "1"); }
    if (panel && panel.querySelector("#gathered")) gather();
    updateProgress();
    var top = document.getElementById("pageTop"); if (top) top.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function updateProgress() {
    tabs.forEach(function (b) {
      var id = b.getAttribute("data-tab");
      if (get(NS + "visited." + id)) b.classList.add("visited");
      var panel = document.getElementById("tab-" + id);
      if (!panel) return;
      var req = panel.querySelectorAll(".answer[data-required], .choices[data-required], .stance-cards[data-required], .mode-grid[data-required]");
      var done = req.length > 0;
      req.forEach(function (el) { if (!isAnswered(el)) done = false; });
      b.classList.toggle("complete", done);
    });
    var total = tabs.length, visited = tabs.filter(function (b) { return b.classList.contains("visited"); }).length;
    var pct = total ? Math.round(visited / total * 100) : 0;
    var f = document.getElementById("progressFill"), p = document.getElementById("progressPct");
    if (f) f.style.width = pct + "%"; if (p) p.textContent = pct + "%";
  }
  function isAnswered(el) {
    if (el.classList.contains("answer")) return (el.value || "").trim().length > 0;
    var k = el.getAttribute("data-key"); return !!get(NS + k) || (el.classList.contains("mode-grid") && !!project("medium"));
  }
  tabs.forEach(function (b) { b.addEventListener("click", function () { switchTab(b.getAttribute("data-tab")); }); });
  document.querySelectorAll(".tab-next").forEach(function (b) { b.addEventListener("click", function () { switchTab(b.getAttribute("data-next")); }); });

  /* ---------- answers ---------- */
  function countWords(s) { s = (s || "").trim(); return s ? s.split(/\s+/).length : 0; }
  function wireAnswer(el) {
    var k = el.getAttribute("data-key"); if (!k) return;
    var saved = get(NS + k);
    if (saved != null) el.value = saved;
    else if (el.getAttribute("data-project") && project(el.getAttribute("data-project"))) el.value = project(el.getAttribute("data-project"));
    else if (el.getAttribute("data-seed-from") && get(ROOT + el.getAttribute("data-seed-from"))) el.value = get(ROOT + el.getAttribute("data-seed-from"));
    var dot = el.parentNode.querySelector(".saved-dot");
    function mark() { if (dot) dot.classList.toggle("saved", (el.value || "").trim().length > 0); var wc = el.parentNode.querySelector(".words"); if (wc) wc.textContent = countWords(el.value) + " words"; }
    function save() { set(NS + k, el.value); var pn = el.getAttribute("data-project"); if (pn) setProject(pn, el.value.trim()); mark(); updateProgress(); refreshGathered(); }
    el.addEventListener("input", save);
    el.addEventListener("change", save);
    mark();
  }
  document.querySelectorAll(".answer").forEach(wireAnswer);

  /* choices: pick one */
  document.querySelectorAll(".choices").forEach(function (g) {
    var k = g.getAttribute("data-key"); var fb = g.parentNode.querySelector(".choice-fb");
    var saved = get(NS + k) || (g.getAttribute("data-project") ? project(g.getAttribute("data-project")) : "");
    g.querySelectorAll(".choice").forEach(function (c) {
      if (saved && c.getAttribute("data-value") === saved) { c.classList.add("sel"); if (fb && c.getAttribute("data-fb")) { fb.innerHTML = c.getAttribute("data-fb"); fb.classList.add("show"); } }
      c.addEventListener("click", function () {
        g.querySelectorAll(".choice").forEach(function (x) { x.classList.remove("sel"); }); c.classList.add("sel");
        set(NS + k, c.getAttribute("data-value"));
        var pn = g.getAttribute("data-project"); if (pn) setProject(pn, c.getAttribute("data-value"));
        if (fb) { if (c.getAttribute("data-fb")) { fb.innerHTML = c.getAttribute("data-fb"); fb.classList.add("show"); } else fb.classList.remove("show"); }
        updateProgress(); refreshGathered();
      });
    });
  });
  /* chips: pick several */
  document.querySelectorAll(".chips").forEach(function (g) {
    var k = g.getAttribute("data-key"); var saved = (get(NS + k) || "").split(" | ").filter(Boolean);
    g.querySelectorAll(".chip").forEach(function (c) {
      if (saved.indexOf(c.getAttribute("data-value")) > -1) c.classList.add("sel");
      c.addEventListener("click", function () {
        c.classList.toggle("sel");
        var vals = []; g.querySelectorAll(".chip.sel").forEach(function (x) { vals.push(x.getAttribute("data-value")); });
        set(NS + k, vals.join(" | ")); updateProgress(); refreshGathered();
      });
    });
  });
  /* stance cards: pick one large card */
  document.querySelectorAll(".stance-cards").forEach(function (g) {
    var k = g.getAttribute("data-key"); var saved = get(NS + k) || (g.getAttribute("data-project") ? project(g.getAttribute("data-project")) : "");
    g.querySelectorAll(".stance-card").forEach(function (c) {
      if (saved && c.getAttribute("data-value") === saved) c.classList.add("sel");
      c.addEventListener("click", function () {
        g.querySelectorAll(".stance-card").forEach(function (x) { x.classList.remove("sel"); }); c.classList.add("sel");
        set(NS + k, c.getAttribute("data-value"));
        var pn = g.getAttribute("data-project"); if (pn) setProject(pn, c.getAttribute("data-value"));
        updateProgress(); refreshGathered();
      });
    });
  });
  /* quick checks */
  document.querySelectorAll(".check-row").forEach(function (row) {
    var fb = row.querySelector(".opt-fb");
    row.querySelectorAll(".opt").forEach(function (o) {
      o.addEventListener("click", function () {
        var right = o.getAttribute("data-correct") === "true";
        row.querySelectorAll(".opt").forEach(function (x) { x.classList.remove("right", "wrong"); });
        o.classList.add(right ? "right" : "wrong");
        if (fb) { fb.textContent = o.getAttribute("data-fb") || (right ? "Yes." : "Not quite. Try another."); fb.className = "opt-fb show " + (right ? "right" : "wrong"); }
      });
    });
  });
  document.querySelectorAll(".check-reset").forEach(function (b) {
    b.addEventListener("click", function () {
      var box = b.closest(".check"); box.querySelectorAll(".opt").forEach(function (x) { x.classList.remove("right", "wrong"); }); box.querySelectorAll(".opt-fb").forEach(function (x) { x.className = "opt-fb"; });
    });
  });

  /* ---------- mode grid (format menus) ---------- */
  document.querySelectorAll(".mode-grid").forEach(function (g) {
    function render() {
      g.innerHTML = "";
      MODES.forEach(function (m) {
        var c = document.createElement("div"); c.className = "mcard" + (project("medium") === m.id ? " sel" : "");
        c.innerHTML = "<div class='mn'>" + esc(m.name) + "</div><div class='md'>" + esc(m.desc) + "</div>";
        c.addEventListener("click", function () { setProject("medium", m.id); set(NS + g.getAttribute("data-key"), m.id); render(); showModeBlocks(); updateProgress(); refreshGathered(); });
        g.appendChild(c);
      });
    }
    render();
  });
  function showModeBlocks() {
    var m = project("medium");
    document.querySelectorAll("[data-show-mode]").forEach(function (el) {
      var list = el.getAttribute("data-show-mode").split(",").map(function (s) { return s.trim(); });
      el.classList.toggle("hide", !(m && list.indexOf(m) > -1));
    });
  }

  /* ---------- seeds ---------- */
  document.querySelectorAll(".seeds").forEach(function (g) {
    var fill = g.getAttribute("data-fill");
    g.querySelectorAll(".seed").forEach(function (b) {
      b.addEventListener("click", function () {
        var target = fill && document.querySelector('.answer[data-key="' + fill + '"]');
        if (!target) return;
        var add = b.getAttribute("data-value") || b.textContent;
        target.value = target.value.trim() ? target.value.replace(/\s+$/, "") + "\n" + add : add;
        target.dispatchEvent(new Event("input", { bubbles: true })); target.focus();
      });
    });
  });

  /* ---------- project strip, project text, carried answers ---------- */
  function renderProject() {
    document.querySelectorAll(".project-strip").forEach(function (s) {
      var fields = (s.getAttribute("data-fields") || "").split(",").map(function (f) { return f.trim(); }).filter(Boolean);
      s.innerHTML = fields.map(function (f) { var v = projectValue(f); return "<div class='pcell'><div class='pk'>" + esc(LABELS[f] || f) + "</div><div class='pv" + (v ? "" : " empty") + "'>" + (v ? esc(v) : "not chosen yet") + "</div></div>"; }).join("");
    });
    document.querySelectorAll("[data-project-text]").forEach(function (el) {
      var v = projectValue(el.getAttribute("data-project-text"));
      el.textContent = v || (el.getAttribute("data-empty") || "(not chosen yet)");
    });
    document.querySelectorAll(".carry").forEach(function (el) {
      var v = ""; (el.getAttribute("data-from") || "").split("|").some(function (src) { v = get(ROOT + src.trim()) || ""; return !!v; });
      var k = el.getAttribute("data-k") || "";
      el.innerHTML = (k ? "<span class='carry-k'>" + esc(k.toUpperCase()) + "</span>" : "") + (v ? esc(v) : esc(el.getAttribute("data-empty") || "Nothing saved yet on this computer. Open your earlier PDF and use what you wrote there."));
      el.classList.toggle("empty", !v);
    });
  }

  /* ---------- gather + PDF ---------- */
  function sections(only) {
    var out = [];
    document.querySelectorAll(".tab-panel").forEach(function (panel) {
      if (only && only.indexOf(panel.id.replace("tab-", "")) < 0) return;
      var btn = document.querySelector('.tab-btn[data-tab="' + panel.id.replace("tab-", "") + '"]');
      var sec = { title: btn ? btn.textContent.replace(/^\s*\d+\s*/, "").trim() : panel.id, items: [] };
      panel.querySelectorAll(".answer, .choices, .chips, .stance-cards, .mode-grid").forEach(function (el) {
        var label = el.getAttribute("data-label"); if (!label) return;
        var v = "";
        if (el.classList.contains("answer")) v = (el.value || "").trim();
        else if (el.classList.contains("mode-grid")) { var m = modeById(project("medium")); v = m ? m.name : ""; }
        else {
          var raw = get(NS + el.getAttribute("data-key")) || "";
          if (el.classList.contains("chips")) v = raw;
          else { var lab = el.querySelector('[data-value="' + raw.replace(/"/g, '\\"') + '"]'); var t = lab && lab.querySelector(".sc-t"); v = t ? t.textContent.trim() : (lab ? lab.textContent.trim() : raw); }
        }
        sec.items.push({ label: label, value: v });
      });
      if (sec.items.length) out.push(sec);
    });
    return out;
  }
  function today() { var t = new Date(); return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0"); }
  function stripFields() { var s = document.querySelector(".project-strip"); return s ? (s.getAttribute("data-fields") || "").split(",").map(function (f) { return f.trim(); }).filter(Boolean) : []; }
  function gatherText() {
    var s = TITLE.toUpperCase() + "\n" + (project("name") || "Name") + " | " + COURSE + " | " + PNAME + " | " + today() + "\n";
    stripFields().forEach(function (f) { var v = projectValue(f); if (v) s += (LABELS[f] || f) + ": " + v + "\n"; });
    s += "==========================================\n\n";
    sections().forEach(function (sec) {
      s += sec.title.toUpperCase() + "\n------------------------------------------\n";
      sec.items.forEach(function (it) { s += "\n" + it.label + "\n" + (it.value || "(no answer yet)") + "\n"; });
      s += "\n";
    });
    return s;
  }
  function gather() { var g = document.getElementById("gathered"); if (g) g.value = gatherText(); }
  function refreshGathered() { var g = document.getElementById("gathered"); if (g && g.closest(".tab-panel") && g.closest(".tab-panel").classList.contains("active")) gather(); }
  function pdfHtml(only, ttl) {
    var T = ttl || TITLE;
    var h = "<!DOCTYPE html><html><head><meta charset='utf-8'><title>" + esc(T) + " | " + esc(project("name") || PNAME) + "</title><style>";
    h += "body{font-family:Georgia,'Times New Roman',serif;max-width:720px;margin:36px auto;padding:0 20px;color:#1a2340;line-height:1.6}";
    h += ".brand{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#6b7a99;letter-spacing:.3px}h1{font-family:'Segoe UI',Arial,sans-serif;font-size:22px;color:#0E1C42;border-bottom:3px solid #55C8E8;padding-bottom:8px;margin:6px 0 4px}";
    h += ".meta{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#6b7a99;margin-bottom:18px}.proj{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;background:#FDF3E3;border-left:4px solid #C7922C;padding:8px 12px;margin-bottom:18px}";
    h += ".sec{font-family:'Segoe UI',Arial,sans-serif;font-size:15px;color:#0E1C42;margin:24px 0 4px;padding-bottom:4px;border-bottom:2px solid #E2E8F4}.q{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#3A4A6B;margin:12px 0 2px}";
    h += ".a{font-size:14px;color:#0E1C42;padding:6px 12px;background:#f8f9fc;border-left:3px solid #D6F2FB;white-space:pre-wrap}.a.none{color:#999;font-style:italic}@page{margin:18mm}</style></head><body>";
    h += "<div class='brand'>OPTIMA ACADEMY ONLINE &middot; " + esc(COURSE.toUpperCase()) + " &middot; " + esc(PNAME.toUpperCase()) + "</div><h1>" + esc(T) + "</h1>";
    h += "<div class='meta'>" + esc(project("name") || "Name") + (ASSIGN ? " &middot; " + esc(ASSIGN) : "") + " &middot; " + today() + "</div>";
    var pj = [];
    stripFields().forEach(function (f) { var v = projectValue(f); if (v) pj.push("<b>" + esc(LABELS[f] || f) + ":</b> " + esc(v)); });
    if (pj.length) h += "<div class='proj'>" + pj.join(" &nbsp;&middot;&nbsp; ") + "</div>";
    sections(only).forEach(function (sec) {
      h += "<div class='sec'>" + esc(sec.title) + "</div>";
      sec.items.forEach(function (it) { h += "<div class='q'>" + esc(it.label) + "</div><div class='a" + (it.value ? "" : " none") + "'>" + (it.value ? esc(it.value) : "(no answer yet)") + "</div>"; });
    });
    h += "</body></html>";
    return h;
  }
  document.querySelectorAll("[data-action='copy']").forEach(function (b) {
    b.addEventListener("click", function () {
      gather(); var g = document.getElementById("gathered"); var st = document.getElementById("gstatus");
      function ok() { if (st) st.textContent = "Copied. Paste it into your Word document or your notebook file."; }
      function fail() { g.select(); if (st) st.textContent = "Select the text above and copy it (Ctrl+C)."; }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(g.value).then(ok, fail); else fail();
    });
  });
  document.querySelectorAll("[data-action='pdf']").forEach(function (b) {
    b.addEventListener("click", function () {
      var box = b.closest(".checkpoint, .act, .tab-panel");
      var st = (box && box.querySelector(".gstatus")) || document.getElementById("gstatus");
      var only = b.getAttribute("data-tabs") ? b.getAttribute("data-tabs").split(",").map(function (x) { return x.trim(); }) : null;
      var ttl = b.getAttribute("data-pdf-title") || "";
      var html = pdfHtml(only, ttl);
      var win = null; try { win = window.open("", "_blank"); } catch (e) { win = null; }
      if (win && win.document) {
        win.document.open(); win.document.write(html); win.document.close();
        setTimeout(function () { try { win.focus(); win.print(); } catch (e) {} }, 500);
        if (st) st.textContent = (b.getAttribute("data-status") || "A print window opened. Choose Save as PDF, then save the file in your OneDrive module folder.");
      } else {
        var blob = new Blob([html], { type: "text/html" }); var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = (project("name") || "LastName").replace(/[^A-Za-z0-9-]/g, "") + "_" + CODE + "_" + LESSON + ".html"; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 1000);
        if (st) st.textContent = "Your browser blocked the print window, so the page downloaded instead. Open it and print to PDF.";
      }
    });
  });
  document.querySelectorAll(".turn-in-item").forEach(function (it) {
    var k = NS + "check." + Array.prototype.indexOf.call(it.parentNode.children, it);
    if (get(k)) { it.classList.add("checked"); it.querySelector(".turn-in-check").textContent = "✓"; }
    it.addEventListener("click", function () { it.classList.toggle("checked"); var on = it.classList.contains("checked"); it.querySelector(".turn-in-check").textContent = on ? "✓" : ""; set(k, on ? "1" : ""); });
  });

  /* ---------- reset (two-step, no native dialogs) ---------- */
  document.querySelectorAll(".reset-btn").forEach(function (b) {
    var armed = false;
    b.addEventListener("click", function () {
      if (!armed) { armed = true; b.classList.add("arm"); b.textContent = "Clear this lesson's answers? Click again to confirm"; setTimeout(function () { armed = false; b.classList.remove("arm"); b.textContent = "Start this lesson over"; }, 6000); return; }
      var keys = []; try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k.indexOf(NS) === 0) keys.push(k); } } catch (e) {}
      keys.forEach(function (k) { set(k, ""); });
      location.reload();
    });
  });

  /* ---------- init ---------- */
  renderProject(); showModeBlocks(); updateProgress();
  var first = tabs.length ? tabs[0].getAttribute("data-tab") : null;
  var last = get(NS + "lastTab");
  switchTab(last && document.getElementById("tab-" + last) ? last : first);
  tabs.forEach(function (b) { b.addEventListener("click", function () { set(NS + "lastTab", b.getAttribute("data-tab")); }); });
  document.querySelectorAll(".tab-next").forEach(function (b) { b.addEventListener("click", function () { set(NS + "lastTab", b.getAttribute("data-next")); }); });
  window.PROJ = { switchTab: switchTab, gather: gather, project: project, setProject: setProject, refresh: function () { renderProject(); showModeBlocks(); updateProgress(); refreshGathered(); } };
})();
