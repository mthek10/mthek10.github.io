/*
 * app.js — Chart Console (Epic-style) rendering + interaction.
 * The app is "dumb": it opens any record with no friction and fires a cancelable
 * pbx:beforeRecordRender BEFORE populating PHI. All access-control logic (reason
 * for access, transaction-match, sensitive-list, volume) lives in the PixieBrix mod.
 */
(function () {
  "use strict";

  var PBX = window.PBX_DEMO;
  var SEED = PBX.clone(PBX.data);
  var state = PBX.clone(SEED);
  var openRecordId = null;
  var activeTab = "encounters";

  var $ = function (id) { return document.getElementById(id); };
  function timeOfDay() { return new Date().toTimeString().slice(0, 5); } // HH:MM
  function initials(p) { return (p.name.first[0] + p.name.last[0]).toUpperCase(); }
  function fullName(p) { return p.name.last + ", " + p.name.first; }

  // --- Optional helpers for the mod ---
  PBX.lookupPatient = function (id) {
    return (state.patients || []).find(function (p) { return p.id === id; });
  };
  PBX.logSink = PBX.logSink || [];

  // --- Live context ---
  function syncContext() {
    var rec = openRecordId ? PBX.lookupPatient(openRecordId) : null;
    PBX.setContext({
      agentId: state.agent.id,
      searchCountSession: state.agent.searchCountSession,
      activeCall: { patientId: state.activeCall.patientId },
      openRecord: rec
        ? { id: rec.id, restricted: rec.restricted, transactionMatch: state.activeCall.patientId === rec.id }
        : { id: null, restricted: null, transactionMatch: null },
      timeOfDay: timeOfDay(),
    });
  }

  // --- Search counter ---
  function renderSearchCounter() {
    $("search-counter").textContent = state.agent.searchCountSession;
  }

  // --- Active-call hook (no visible widget; drives transaction-match) ---
  function renderSoftphone() {
    var sp = $("softphone");
    if (!sp) return;
    sp.setAttribute("data-pbx-active-call-patient", state.activeCall.patientId || "");
  }

  // When the active call changes, reflect transaction-match on any open chart.
  function refreshTransactionMatch() {
    if (!openRecordId) return;
    var match = state.activeCall.patientId === openRecordId;
    $("patient-chart").setAttribute("data-pbx-transaction-match", String(match));
    syncContext();
  }

  // Programmatic active-call control. The visible Start/End buttons were removed;
  // the active call is set by the PixieBrix mod / real telephony, or from the
  // console for demos: PBX_DEMO.setActiveCall("MRN-0099821") / setActiveCall(null).
  PBX.setActiveCall = function (patientId) {
    state.activeCall.patientId = patientId || null;
    renderSoftphone();
    refreshTransactionMatch();
    syncContext();
  };

  // --- Search ---
  function renderSearchResults() {
    var q = ($("patient-search").value || "").trim().toLowerCase();
    var box = $("search-results");
    if (!q) { box.hidden = true; box.innerHTML = ""; return; }
    var rows = state.patients.filter(function (p) {
      return (p.name.first + " " + p.name.last).toLowerCase().indexOf(q) >= 0 ||
        p.name.last.toLowerCase().indexOf(q) >= 0 ||
        p.id.toLowerCase().indexOf(q) >= 0 ||
        (p.dob || "").indexOf(q) >= 0;
    });
    if (!rows.length) { box.hidden = true; box.innerHTML = ""; return; }
    box.innerHTML = rows
      .map(function (p) {
        return '<button data-open-id="' + p.id + '">' + fullName(p) + " · " + p.ageSex +
          ' <span class="sr-sub">' + p.id + "</span></button>";
      })
      .join("");
    box.hidden = false;
  }

  // A search action: increments the session counter, then opens the record.
  function executeSearch(patientId) {
    $("search-results").hidden = true;
    $("patient-search").value = "";
    state.agent.searchCountSession += 1;
    renderSearchCounter();
    openPatient(patientId);
  }

  // --- Open patient (the interactive core, section 5.4) ---
  // Opening a patient triggers a real page navigation (the URL changes to
  // ?patient=<MRN>) via the History API, so PixieBrix's page-load / navigation
  // trigger latches onto the patient profile. In-memory state is preserved
  // (no full reload), and deep-links / back-forward are supported.
  function navigateToPatient(id) {
    var target = "?patient=" + encodeURIComponent(id);
    if (location.search !== target) {
      history.pushState({ patientId: id }, "", location.pathname + target);
    }
  }

  // User action: navigate to the patient profile, then render it.
  function openPatient(id) {
    if (!PBX.lookupPatient(id)) return;
    navigateToPatient(id);
    renderPatient(id);
  }

  // Render a patient's chart (no navigation). Used on open, deep-link, back/forward.
  function renderPatient(id) {
    var p = PBX.lookupPatient(id);
    if (!p) return;
    openRecordId = id;
    var transactionMatch = state.activeCall.patientId === id;

    var detail = {
      recordId: id,
      restricted: p.restricted,
      transactionMatch: transactionMatch,
      searchCountSession: state.agent.searchCountSession,
      timeOfDay: timeOfDay(),
    };
    syncContext();

    // Cancelable BEFORE PHI is populated. true → render PHI; false → withhold.
    var ok = PBX.dispatchBefore("pbx:beforeRecordRender", detail);
    // Always emit the non-cancelable opened event (for logging).
    PBX.notify("pbx:recordOpened", detail);

    renderChart(p, transactionMatch, ok);
  }

  function closeChart() {
    openRecordId = null;
    $("patient-chart").hidden = true;
    $("empty-state").hidden = false;
    $("storyboard").innerHTML = '<div class="sb-empty">No patient selected.</div>';
    syncContext();
  }

  // Open the patient named in the URL (?patient=<MRN>) — deep link / reload.
  function openFromUrl() {
    var id = new URLSearchParams(location.search).get("patient");
    if (id && PBX.lookupPatient(id)) renderPatient(id);
  }

  // --- Render the Storyboard + work area ---
  function renderChart(p, transactionMatch, renderPHI) {
    // Chart container attributes (always current)
    var chart = $("patient-chart");
    chart.setAttribute("data-pbx-record-id", p.id);
    chart.setAttribute("data-pbx-restricted", String(p.restricted));
    chart.setAttribute("data-pbx-transaction-match", String(transactionMatch));
    chart.hidden = false;
    $("empty-state").hidden = true;

    renderStoryboard(p, renderPHI);
    renderEncounters(p, renderPHI);
    renderMedsStub(p, renderPHI);
  }

  // PHI value span — text only when renderPHI is true (withheld on cancel).
  function phi(tag, value, renderPHI) {
    return '<span data-pbx-mask data-pbx-phi="' + tag + '">' + (renderPHI ? value : "") + "</span>";
  }

  function renderStoryboard(p, renderPHI) {
    var bannerCls = p.restricted ? "sb-banner restricted" : "sb-banner";
    var badge = p.restricted ? '<div class="sb-restricted-badge">⚠ Restricted</div>' : "";

    var html =
      '<div class="' + bannerCls + '">' +
        '<div class="sb-avatar">' + initials(p) + "</div>" +
        "<div>" +
          '<div class="sb-name">' + fullName(p) + "</div>" +
          '<div class="sb-agesex">' + p.ageSex + "</div>" +
          badge +
        "</div>" +
      "</div>" +

      // Demographics
      '<div class="sb-section">' +
        '<div class="sb-label">Demographics</div>' +
        '<div class="sb-kv"><span class="k">MRN</span><span class="v">' + phi("mrn", p.id, renderPHI) + "</span></div>" +
        '<div class="sb-kv"><span class="k">DOB</span><span class="v">' + phi("dob", p.dob, renderPHI) + "</span></div>" +
        '<div class="sb-kv"><span class="k">Phone</span><span class="v">' + phi("phone", p.phone, renderPHI) + "</span></div>" +
      "</div>" +

      // Allergies
      '<div class="sb-section">' +
        '<div class="sb-label">Allergies</div>' +
        '<div class="sb-value">' + phi("allergy", p.allergies.join(", "), renderPHI) + "</div>" +
      "</div>" +

      // Problem list
      '<div class="sb-section">' +
        '<div class="sb-label">Problem list</div>' +
        '<div class="sb-value">' + phi("problem", p.problems.join(", "), renderPHI) + "</div>" +
      "</div>" +

      // Medications
      '<div class="sb-section">' +
        '<div class="sb-label">Medications</div>' +
        '<div class="sb-value">' + phi("med", p.meds.join(", "), renderPHI) + "</div>" +
      "</div>" +

      // Care team / PCP
      '<div class="sb-section">' +
        '<div class="sb-label">Care team / PCP</div>' +
        '<div class="sb-value">' + phi("care-team", p.pcp, renderPHI) + "</div>" +
      "</div>" +

      // Coverage
      '<div class="sb-section">' +
        '<div class="sb-label">Coverage</div>' +
        '<div class="sb-value">' + phi("coverage", p.coverage, renderPHI) + "</div>" +
      "</div>";

    $("storyboard").innerHTML = html;
  }

  function renderEncounters(p, renderPHI) {
    var body = $("enc-body");
    var empty = $("enc-empty");
    if (!renderPHI) {
      body.innerHTML = "";
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    body.innerHTML = p.encounters
      .map(function (e) {
        return "<tr>" +
          '<td class="date">' + e.date + "</td>" +
          "<td>" + e.type + "</td>" +
          "<td>" + e.department + "</td>" +
          "<td>" + e.provider + "</td>" +
          "<td>" + e.dx + "</td>" +
          "</tr>";
      })
      .join("");
  }

  function renderMedsStub(p, renderPHI) {
    $("meds-stub").innerHTML = renderPHI
      ? phi("med", p.meds.join(" · "), true)
      : '<span data-pbx-mask data-pbx-phi="med"></span>';
  }

  // --- Tabs ---
  function setTab(name) {
    activeTab = name;
    document.querySelectorAll("#tab-ribbon button").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-tab") === name);
    });
    document.querySelectorAll(".tab-panel").forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-tab") !== name;
    });
  }

  // --- Wiring ---
  function wire() {
    var search = $("patient-search");
    search.addEventListener("input", renderSearchResults);
    search.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      var first = $("search-results").querySelector("button[data-open-id]");
      if (first) executeSearch(first.getAttribute("data-open-id"));
    });
    $("search-results").addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-open-id]");
      if (btn) executeSearch(btn.getAttribute("data-open-id"));
    });

    // Tabs
    $("tab-ribbon").addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-tab]");
      if (btn) setTab(btn.getAttribute("data-tab"));
    });

    // Dismiss the search results on outside click
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".lookup")) $("search-results").hidden = true;
    });
  }

  // --- Reset ---
  PBX.onReset(function () {
    state = PBX.clone(SEED);
    openRecordId = null;
    activeTab = "encounters";
    $("patient-search").value = "";
    $("search-results").hidden = true;
    $("patient-chart").hidden = true;
    $("empty-state").hidden = false;
    $("storyboard").innerHTML = '<div class="sb-empty">No patient selected.</div>';
    setTab("encounters");
    renderSearchCounter();
    renderSoftphone();
    syncContext();
    // Clear the ?patient= navigation so PixieBrix sees a fresh "no chart" URL.
    history.replaceState({}, "", location.pathname);
  });
  PBX.wireResetButton("btn-reset");

  // Back/forward between patient profiles (and back to the empty state).
  window.addEventListener("popstate", function () {
    var id = new URLSearchParams(location.search).get("patient");
    if (id && PBX.lookupPatient(id)) renderPatient(id);
    else closeChart();
  });

  // --- Init: no chart open (unless deep-linked via ?patient=), call idle, counter 0 ---
  renderSearchCounter();
  renderSoftphone();
  wire();
  syncContext();
  openFromUrl();
})();
