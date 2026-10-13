/* Into the World: shared lesson engine (English IV Honors).
   Markup contract (see _HONORS-BUILD-SPEC.md section 8):
   <body data-lesson="L1" data-title="Lesson 1: Enter a World" data-assignment="Assignment 1">
   .tab-bar > button.tab-btn[data-tab]      .tab-panel#tab-<id>      button.tab-next[data-next]
   .answer[data-key][data-label]            (textarea | input | select) autosaves to localStorage under itw.<lesson>.<key>
   .answer[data-project="world|stance|role|audience|goal|framework|medium|question|name"] also saves to itw.project.<name>
   .choices[data-key] > button.choice[data-value][data-fb]      pick one, stored, optional feedback
   .chips[data-key] > button.chip[data-value]                   pick several, stored as "a | b"
   .stance-cards[data-key] > .stance-card[data-value]           pick one (large cards)
   .check > .check-row > .opts > button.opt[data-correct][data-fb]   ungraded quick check with instant feedback
   .world-grid[data-key]  renders window.ITW_WORLDS; .mode-grid[data-key] renders ITW.MODES
   .seeds[data-from="roles|audiences|genres"][data-fill="<key>"]  clickable seeds from the chosen world
   [data-project-text="world|role|..."]  shows the saved project value      .project-strip  auto-renders the summary
   [data-show-mode="vlog,podcast"]       shown only when the saved medium matches
   #gathered, [data-action="copy|pdf"], .turn-in-item, .reset-btn
*/
(function () {
  "use strict";
  var body = document.body;
  var LESSON = body.getAttribute("data-lesson") || "L0";
  var TITLE = body.getAttribute("data-title") || "Into the World";
  var ASSIGN = body.getAttribute("data-assignment") || "";
  var NS = "itw." + LESSON + ".";
  var PNS = "itw.project.";
  var worlds = window.ITW_WORLDS || [];

  var MODES = [
    { id: "vlog", name: "Vlog", desc: "Three scripted episodes, 6 to 10 minutes each, on camera and in role, with a page that lists your sources." },
    { id: "podcast", name: "Podcast", desc: "Two episodes of 15 to 20 minutes, or one of 30, in role, with show notes and a sources page." },
    { id: "article", name: "Feature article", desc: "One long piece of 2,500 to 3,500 words for an online publication: headline, opening summary, pull quotes, images you have permission to use, sources at the end." },
    { id: "imitation", name: "Imitation", desc: "A real public genre (testimony to a council, an op-ed series, a public lecture) or a genre from your world's own text. About 3,000 words or the performed equivalent, with a public reading." },
    { id: "address", name: "The Address", desc: "A formal speech of 15 to 20 minutes in classical structure, delivered to a gathered audience, with the full text published." }
  ];
  window.ITW = { MODES: MODES };

  /* ---------- storage ---------- */
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { if (v === "" || v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function project(name) { return get(PNS + name) || ""; }
  function setProject(name, v) { set(PNS + name, v); renderProject(); }
  function worldById(id) { for (var i = 0; i < worlds.length; i++) if (worlds[i].id === id) return worlds[i]; return null; }
  function currentWorld() { return worldById(project("worldId")); }
  function modeById(id) { for (var i = 0; i < MODES.length; i++) if (MODES[i].id === id) return MODES[i]; return null; }

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
      var req = panel.querySelectorAll(".answer[data-required], .choices[data-required], .stance-cards[data-required], .world-grid[data-required], .mode-grid[data-required]");
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
    var k = el.getAttribute("data-key"); return !!get(NS + k) || (el.classList.contains("world-grid") && !!project("worldId")) || (el.classList.contains("mode-grid") && !!project("medium"));
  }
  tabs.forEach(function (b) { b.addEventListener("click", function () { switchTab(b.getAttribute("data-tab")); }); });
  document.querySelectorAll(".tab-next").forEach(function (b) { b.addEventListener("click", function () { switchTab(b.getAttribute("data-next")); }); });

  /* ---------- answers ---------- */
  function wireAnswer(el) {
    var k = el.getAttribute("data-key"); if (!k) return;
    var saved = get(NS + k);
    if (saved != null) el.value = saved; else if (el.getAttribute("data-project") && project(el.getAttribute("data-project"))) el.value = project(el.getAttribute("data-project"));
    var dot = el.parentNode.querySelector(".saved-dot");
    function mark() { if (dot) dot.classList.toggle("saved", (el.value || "").trim().length > 0); var wc = el.parentNode.querySelector(".words"); if (wc) wc.textContent = countWords(el.value) + " words"; }
    el.addEventListener("input", function () {
      set(NS + k, el.value);
      var pn = el.getAttribute("data-project"); if (pn) setProject(pn, el.value.trim());
      mark(); updateProgress(); refreshGathered();
    });
    el.addEventListener("change", function () { set(NS + k, el.value); var pn = el.getAttribute("data-project"); if (pn) setProject(pn, el.value.trim()); mark(); updateProgress(); });
    mark();
  }
  function countWords(s) { s = (s || "").trim(); return s ? s.split(/\s+/).length : 0; }
  document.querySelectorAll(".answer").forEach(wireAnswer);

  /* choices: pick one */
  document.querySelectorAll(".choices").forEach(function (g) {
    var k = g.getAttribute("data-key"); var fb = g.parentNode.querySelector(".choice-fb");
    var saved = get(NS + k);
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
        updateProgress(); refreshGathered(); renderSeeds();
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

  /* ---------- world grid ---------- */
  var openWorld = null;
  document.querySelectorAll(".world-grid").forEach(function (g) {
    var detail = document.createElement("div"); detail.className = "wdetail hide"; g.parentNode.insertBefore(detail, g.nextSibling);
    function render() {
      g.innerHTML = "";
      if (!worlds.length) { g.innerHTML = "<div class='callout-gold'>The world cards did not load. Tell your teacher which page you opened.</div>"; return; }
      worlds.forEach(function (w) {
        var c = document.createElement("div");
        c.className = "wcard" + (openWorld === w.id ? " open" : "") + (project("worldId") === w.id ? " sel" : "");
        c.innerHTML = (w.image ? "<div class='wimg' style=\"background-image:url('" + esc(w.image) + "')\"></div>" : "") + "<div class='wn'>" + esc(w.name) + "</div><div class='wf'>" + esc(w.from) + "</div><div class='wq'>" + esc(w.question) + "</div>" + (project("worldId") === w.id ? "<span class='wpick'>Your world</span>" : "<span class='wpick'>Open</span>");
        c.addEventListener("click", function () { openWorld = (openWorld === w.id) ? null : w.id; render(); renderDetail(); });
        g.appendChild(c);
      });
    }
    function renderDetail() {
      var w = worldById(openWorld);
      if (!w) { detail.classList.add("hide"); return; }
      detail.classList.remove("hide");
      var pickable = g.getAttribute("data-pick") !== "false";
      var h = (w.image ? "<figure class='wfig'><img src='" + esc(w.image) + "' alt='" + esc(w.name) + "' /><figcaption>" + esc(w.credit || "") + (w.creditUrl ? " <a href='" + esc(w.creditUrl) + "' target='_blank' rel='noopener'>Museum record</a>" : "") + "</figcaption></figure>" : "");
      h += "<div class='dk'>" + esc(w.name).toUpperCase() + " &middot; " + esc(w.from) + "</div><div class='dwhen'>" + esc(w.when) + "</div><div class='dsnap'>" + esc(w.snapshot) + "</div>";
      h += "<div class='dk'>THE QUESTION THIS WORLD CANNOT SETTLE</div><p><em>" + esc(w.question) + "</em></p>";
      h += "<div class='dk'>PEOPLE WHO SPEAK IN THIS WORLD</div><ul>" + w.roles.inWorld.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + "</ul>";
      h += "<div class='dk'>PEOPLE WHO SPEAK ABOUT IT TODAY</div><ul>" + w.roles.presentDay.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + "</ul>";
      h += "<div class='dk'>AUDIENCES</div><ul>" + w.audiences.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + "</ul>";
      h += "<div class='dk'>KINDS OF WRITING AND SPEECH FOUND HERE</div><ul>" + w.genres.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + "</ul>";
      h += "<div class='dk'>THREADS A RESEARCHER COULD PULL</div><ul>" + w.threads.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + "</ul>";
      h += "<div class='dk'>WHAT YOU OWE THIS WORLD</div><p>" + esc(w.fidelity) + "</p><div class='dk'>COPYRIGHT</div><p>" + esc(w.copyright) + "</p>";
      if (pickable) h += "<button class='pick-btn" + (project("worldId") === w.id ? " sel" : "") + "' id='pickWorldBtn'>" + (project("worldId") === w.id ? "This is your world" : "Choose this world") + "</button>";
      detail.innerHTML = h;
      var pb = document.getElementById("pickWorldBtn");
      if (pb) pb.addEventListener("click", function () { setProject("worldId", w.id); setProject("world", w.name); set(NS + g.getAttribute("data-key"), w.id); render(); renderDetail(); renderSeeds(); updateProgress(); refreshGathered(); detail.scrollIntoView({ behavior: "smooth", block: "nearest" }); });
    }
    render();
  });

  /* ---------- mode grid ---------- */
  document.querySelectorAll(".mode-grid").forEach(function (g) {
    function render() {
      g.innerHTML = "";
      MODES.forEach(function (m) {
        var c = document.createElement("div"); c.className = "mcard" + (project("medium") === m.id ? " sel" : "");
        c.innerHTML = "<div class='mn'>" + esc(m.name) + "</div><div class='md'>" + esc(m.desc) + "</div>";
        c.addEventListener("click", function () { setProject("medium", m.id); setProject("mediumName", m.name); set(NS + g.getAttribute("data-key"), m.id); render(); showModeBlocks(); updateProgress(); refreshGathered(); });
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
    document.querySelectorAll("[data-hide-if-no-mode]").forEach(function (el) { el.classList.toggle("hide", !m); });
  }

  /* ---------- seeds from the chosen world ---------- */
  function renderSeeds() {
    var w = currentWorld();
    document.querySelectorAll(".seeds").forEach(function (g) {
      var from = g.getAttribute("data-from"), fill = g.getAttribute("data-fill");
      g.innerHTML = "";
      if (!w) { g.innerHTML = "<span class='small'>Choose a world first and seeds will appear here.</span>"; return; }
      var items = [];
      if (from === "roles") {
        var st = project("stance");
        if (st !== "present") w.roles.inWorld.forEach(function (r) { items.push({ t: r, present: false }); });
        if (st !== "inworld") w.roles.presentDay.forEach(function (r) { items.push({ t: r, present: true }); });
      } else if (from === "audiences") w.audiences.forEach(function (a) { items.push({ t: a }); });
      else if (from === "genres") w.genres.forEach(function (a) { items.push({ t: a }); });
      else if (from === "threads") w.threads.forEach(function (a) { items.push({ t: a }); });
      items.forEach(function (it) {
        var b = document.createElement("button"); b.type = "button"; b.className = "seed" + (it.present ? " present" : ""); b.textContent = it.t;
        b.addEventListener("click", function () {
          var target = fill && document.querySelector('.answer[data-key="' + fill + '"]');
          if (target) { target.value = it.t; target.dispatchEvent(new Event("input", { bubbles: true })); target.focus(); }
        });
        g.appendChild(b);
      });
    });
  }

  /* ---------- project strip + text fills ---------- */
  function renderProject() {
    var w = currentWorld(); var m = modeById(project("medium"));
    var vals = { world: w ? w.name : project("world"), stance: project("stance") === "inworld" ? "In the world" : (project("stance") === "present" ? "In the present" : ""), role: project("role"), audience: project("audience"), goal: project("goal"), framework: project("framework"), medium: m ? m.name : "", question: project("question"), name: project("name") };
    document.querySelectorAll(".project-strip").forEach(function (s) {
      var fields = (s.getAttribute("data-fields") || "world,role,audience,goal,medium").split(",");
      var labels = { world: "Your world", stance: "Your stance", role: "Your role", audience: "Your audience", goal: "Your goal", framework: "Your framework", medium: "Your medium", question: "Your question", name: "Name" };
      s.innerHTML = fields.map(function (f) { f = f.trim(); var v = vals[f]; return "<div class='pcell'><div class='pk'>" + esc(labels[f] || f) + "</div><div class='pv" + (v ? "" : " empty") + "'>" + (v ? esc(v) : "not chosen yet") + "</div></div>"; }).join("");
    });
    document.querySelectorAll("[data-project-text]").forEach(function (el) {
      var f = el.getAttribute("data-project-text"); var v = vals[f];
      el.textContent = v || (el.getAttribute("data-empty") || "(not chosen yet)");
    });
  }

  /* ---------- gather + PDF ---------- */
  function sections() {
    var out = [];
    document.querySelectorAll(".tab-panel").forEach(function (panel) {
      var btn = document.querySelector('.tab-btn[data-tab="' + panel.id.replace("tab-", "") + '"]');
      var sec = { title: btn ? btn.textContent.replace(/^\s*\d+\s*/, "").trim() : panel.id, items: [] };
      panel.querySelectorAll(".answer, .choices, .chips, .stance-cards, .world-grid, .mode-grid").forEach(function (el) {
        var label = el.getAttribute("data-label"); if (!label) return;
        var v = "";
        if (el.classList.contains("answer")) v = (el.value || "").trim();
        else if (el.classList.contains("world-grid")) { var w = currentWorld(); v = w ? w.name + " (" + w.from + ")" : ""; }
        else if (el.classList.contains("mode-grid")) { var m = modeById(project("medium")); v = m ? m.name : ""; }
        else {
          var raw = get(NS + el.getAttribute("data-key")) || "";
          if (el.classList.contains("chips")) v = raw;
          else { var lab = el.querySelector('[data-value="' + raw + '"]'); var t = lab && lab.querySelector(".sc-t"); v = t ? t.textContent.trim() : (lab ? lab.textContent.trim() : raw); }
        }
        sec.items.push({ label: label, value: v });
      });
      if (sec.items.length) out.push(sec);
    });
    return out;
  }
  function today() { var t = new Date(); return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0"); }
  function gatherText() {
    var w = currentWorld();
    var s = TITLE.toUpperCase() + "\n" + (project("name") || "Name") + " | English IV Honors | Into the World | " + today() + "\n";
    if (w) s += "World: " + w.name + "\n";
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
  function pdfHtml() {
    var w = currentWorld(); var m = modeById(project("medium"));
    var h = "<!DOCTYPE html><html><head><meta charset='utf-8'><title>" + esc(TITLE) + " | " + esc(project("name") || "Into the World") + "</title><style>";
    h += "body{font-family:Georgia,'Times New Roman',serif;max-width:720px;margin:36px auto;padding:0 20px;color:#1a2340;line-height:1.6}";
    h += ".brand{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#6b7a99;letter-spacing:.3px}h1{font-family:'Segoe UI',Arial,sans-serif;font-size:22px;color:#0E1C42;border-bottom:3px solid #55C8E8;padding-bottom:8px;margin:6px 0 4px}";
    h += ".meta{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#6b7a99;margin-bottom:18px}.proj{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;background:#FDF3E3;border-left:4px solid #C7922C;padding:8px 12px;margin-bottom:18px}";
    h += ".sec{font-family:'Segoe UI',Arial,sans-serif;font-size:15px;color:#0E1C42;margin:24px 0 4px;padding-bottom:4px;border-bottom:2px solid #E2E8F4}.q{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#3A4A6B;margin:12px 0 2px}";
    h += ".a{font-size:14px;color:#0E1C42;padding:6px 12px;background:#f8f9fc;border-left:3px solid #D6F2FB;white-space:pre-wrap}.a.none{color:#999;font-style:italic}@page{margin:18mm}</style></head><body>";
    h += "<div class='brand'>OPTIMA ACADEMY ONLINE &middot; ENGLISH IV HONORS &middot; INTO THE WORLD</div><h1>" + esc(TITLE) + "</h1>";
    h += "<div class='meta'>" + esc(project("name") || "Name") + " &middot; " + esc(ASSIGN) + " &middot; " + today() + "</div>";
    var pj = [];
    if (w) pj.push("<b>World:</b> " + esc(w.name)); if (project("role")) pj.push("<b>Role:</b> " + esc(project("role"))); if (project("audience")) pj.push("<b>Audience:</b> " + esc(project("audience"))); if (project("goal")) pj.push("<b>Goal:</b> " + esc(project("goal"))); if (m) pj.push("<b>Medium:</b> " + esc(m.name));
    if (pj.length) h += "<div class='proj'>" + pj.join(" &nbsp;&middot;&nbsp; ") + "</div>";
    sections().forEach(function (sec) {
      h += "<div class='sec'>" + esc(sec.title) + "</div>";
      sec.items.forEach(function (it) { h += "<div class='q'>" + esc(it.label) + "</div><div class='a" + (it.value ? "" : " none") + "'>" + (it.value ? esc(it.value) : "(no answer yet)") + "</div>"; });
    });
    h += "</body></html>";
    return h;
  }
  document.querySelectorAll("[data-action='copy']").forEach(function (b) {
    b.addEventListener("click", function () {
      gather(); var g = document.getElementById("gathered"); var st = document.getElementById("gstatus");
      function ok() { if (st) st.textContent = "Copied. Paste it into Canvas or into your notebook file."; }
      function fail() { g.select(); if (st) st.textContent = "Select the text above and copy it (Ctrl+C)."; }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(g.value).then(ok, fail); else fail();
    });
  });
  document.querySelectorAll("[data-action='pdf']").forEach(function (b) {
    b.addEventListener("click", function () {
      var st = document.getElementById("gstatus");
      var win = null; try { win = window.open("", "_blank"); } catch (e) { win = null; }
      if (win && win.document) {
        win.document.open(); win.document.write(pdfHtml()); win.document.close();
        setTimeout(function () { try { win.focus(); win.print(); } catch (e) {} }, 500);
        if (st) st.textContent = "A print window opened. Choose Save as PDF, then add the file to your notebook or portfolio.";
      } else {
        var blob = new Blob([pdfHtml()], { type: "text/html" }); var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = (project("name") || "LastName").replace(/[^A-Za-z0-9-]/g, "") + "_ENG4H_" + LESSON + ".html"; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 1000);
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
  renderSeeds(); renderProject(); showModeBlocks(); updateProgress();
  var first = tabs.length ? tabs[0].getAttribute("data-tab") : null;
  var last = get(NS + "lastTab");
  switchTab(last && document.getElementById("tab-" + last) ? last : first);
  tabs.forEach(function (b) { b.addEventListener("click", function () { set(NS + "lastTab", b.getAttribute("data-tab")); }); });
  document.querySelectorAll(".tab-next").forEach(function (b) { b.addEventListener("click", function () { set(NS + "lastTab", b.getAttribute("data-next")); }); });
  window.ITW.switchTab = switchTab; window.ITW.gather = gather; window.ITW.project = project; window.ITW.setProject = setProject;
  window.ITW.refresh = function () { renderSeeds(); renderProject(); showModeBlocks(); updateProgress(); refreshGathered(); };
})();
