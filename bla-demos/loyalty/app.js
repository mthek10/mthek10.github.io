/*
 * app.js — FQTV Servicing Console rendering + interaction.
 * The app is "dumb": it lets risky servicing actions through and only fires a
 * cancelable pbx:beforeSubmit first. All guardrail logic lives in the PixieBrix mod.
 */
(function () {
  "use strict";

  var PBX = window.PBX_DEMO;
  var SEED = PBX.clone(PBX.data);
  var state = PBX.clone(SEED);
  var member = state.members[0];
  var agent = state.agent;
  var activeAction = "transfer"; // goodwill | retro | transfer | redemption

  var ACTION_NAME = {
    goodwill: "goodwill-adjustment",
    retro: "retro-claim",
    transfer: "points-transfer",
    redemption: "redemption",
  };

  var $ = function (id) { return document.getElementById(id); };
  function fmt(n) { return Number(n).toLocaleString("en-US"); }
  function milesMarkup(m) {
    var cls = m >= 0 ? "miles-pos" : "miles-neg";
    var sign = m >= 0 ? "+" : "−";
    return '<span class="' + cls + '">' + sign + fmt(Math.abs(m)) + "</span>";
  }
  function todayDDMON() {
    var d = new Date();
    var mon = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][d.getMonth()];
    return String(d.getDate()).padStart(2, "0") + mon;
  }

  // --- Optional helpers exposed for the mod ---
  PBX.lookupAccount = function (id) {
    return (state.accounts || []).find(function (a) { return a.id === id; });
  };
  PBX.logSink = PBX.logSink || [];

  function selectedAccount() {
    return PBX.lookupAccount($("transfer-recipient").value);
  }
  function lookupRetro(flightNo) {
    var q = (flightNo || "").trim().toUpperCase();
    return (state.retroClaims || []).find(function (r) { return r.flightNo.toUpperCase() === q; });
  }

  // --- Render: profile header ---
  function renderHeader() {
    $("p-avatar").textContent = (member.name.first[0] + member.name.last[0]).toUpperCase();
    $("p-name").textContent = member.name.last + " / " + member.name.first + " " + member.name.title;
    $("p-tier").textContent = member.tier;
    $("p-sub").innerHTML =
      "FQTV " + member.id + " · PNR " + member.pnr +
      ' · card ••<span data-pbx-mask data-pbx-phi="cobrand-card">' + member.coBrandCardLast4 + "</span>";
    $("available-miles").textContent = fmt(member.balance);
    $("p-next").textContent = fmt(member.milesToNextTier) + " to " + member.nextTier;
    $("cmd-echo").textContent = "> FQTV/" + member.id.replace(/-/g, "") + "_";
  }

  function renderCounter() {
    $("manual-credits-counter").textContent = "⚠ Manual credits today: " + agent.manualCreditsToday;
  }

  // --- Render: ledger ---
  var WARN_TYPES = ["Manual", "Goodwill adj", "Transfer", "Retro"];
  function renderLedger() {
    $("ledger-body").innerHTML = member.ledger
      .map(function (row) {
        var flagged = WARN_TYPES.indexOf(row.type) >= 0;
        return (
          "<tr" + (flagged ? ' class="flagged"' : "") + ">" +
          '<td class="date">' + row.date + "</td>" +
          "<td>" + row.description + "</td>" +
          "<td>" + row.type + "</td>" +
          '<td class="num miles">' + milesMarkup(row.miles) + "</td>" +
          '<td class="num bal">' + fmt(row.balance) + "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  // --- Render: recipient option lists ---
  function renderRecipients() {
    var opts = state.accounts
      .map(function (a) {
        return '<option value="' + a.id + '">' + a.id + " · " + a.ageDays + " days old</option>";
      })
      .join("");
    $("transfer-recipient").innerHTML = opts;
    $("redeem-recipient-account").innerHTML = opts;
  }

  // --- Live context ---
  function activeAmount() {
    if (activeAction === "transfer") return Number($("transfer-amount").value) || 0;
    if (activeAction === "goodwill") return Number($("adjust-amount").value) || 0;
    if (activeAction === "redemption") return Number($("redeem-miles").value) || 0;
    if (activeAction === "retro") {
      var r = lookupRetro($("retro-flight-no").value);
      return r ? r.milesIfAccepted : 0;
    }
    return 0;
  }

  function contextRecipient() {
    if (activeAction === "transfer") {
      var a = selectedAccount();
      return a ? { id: a.id, ageDays: a.ageDays } : null;
    }
    if (activeAction === "redemption" && $("redeem-recipient").value === "Other account") {
      var b = PBX.lookupAccount($("redeem-recipient-account").value);
      return b ? { id: b.id, ageDays: b.ageDays } : null;
    }
    return null;
  }

  function contextRetro() {
    var r = activeAction === "retro" ? lookupRetro($("retro-flight-no").value) : null;
    return {
      matchingFlightExists: r ? r.matchingFlightExists : null,
      daysSinceDeparture: r ? r.daysSinceDeparture : null,
      windowMin: 14,
      windowMax: 180,
    };
  }

  function syncContext() {
    // keep data-pbx-recipient-age-days current on the transfer select
    var a = selectedAccount();
    $("transfer-recipient").setAttribute("data-pbx-recipient-age-days", a ? String(a.ageDays) : "");

    PBX.setContext({
      action: ACTION_NAME[activeAction],
      agentManualCreditsToday: agent.manualCreditsToday,
      peerBaseline: agent.peerBaseline,
      amount: activeAmount(),
      recipient: contextRecipient(),
      retro: contextRetro(),
    });
  }

  // --- Field validation: disable a submit until all its fields are filled ---
  function validateTransfer() {
    var recip = $("transfer-recipient").value;
    var amt = ($("transfer-amount").value || "").trim();
    var valid = !!recip && amt !== "" && Number(amt) > 0;
    $("btn-submit-points-transfer").disabled = !valid;
  }
  function validateGoodwill() {
    var amt = ($("adjust-amount").value || "").trim();
    var reason = ($("adjust-reason").value || "").trim();
    var valid = amt !== "" && Number(amt) > 0 && reason !== "";
    $("btn-submit-goodwill-adjustment").disabled = !valid;
  }
  function validateActions() {
    validateTransfer();
    validateGoodwill();
  }

  // --- Retro indicator ---
  function updateRetroStatus() {
    var r = lookupRetro($("retro-flight-no").value);
    var match = r ? (r.matchingFlightExists ? "yes" : "no") : "—";
    var days = r ? r.daysSinceDeparture : "—";
    var miles = r ? " · miles if accepted: " + fmt(r.milesIfAccepted) : "";
    $("retro-status").textContent =
      "Back-dating window 14–180 days · matching flight: " + match +
      " · days since departure: " + days + miles;
    syncContext();
  }

  // --- Action switching ---
  function setAction(name) {
    activeAction = name;
    document.querySelectorAll("#action-seg button").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-action") === name);
    });
    document.querySelectorAll(".action[data-action]").forEach(function (el) {
      el.hidden = el.getAttribute("data-action") !== name;
    });
    syncContext();
    validateActions();
  }

  // --- Commit helpers ---
  function commit(row, balanceDelta, bumpCounter) {
    member.balance += balanceDelta;
    row.balance = member.balance;
    member.ledger.unshift(row);
    if (bumpCounter) agent.manualCreditsToday += 1;
    renderHeader();
    renderCounter();
    renderLedger();
    syncContext();
  }

  // --- Servicing submits (dispatch cancelable event, commit only if proceed) ---
  function submitGoodwill() {
    var amount = Number($("adjust-amount").value) || 0;
    var reason = $("adjust-reason").value || "";
    var detail = {
      action: "goodwill-adjustment",
      amount: amount,
      reason: reason,
      agentManualCreditsToday: agent.manualCreditsToday,
      peerBaseline: agent.peerBaseline,
    };
    if (!PBX.dispatchBefore("pbx:beforeSubmit", detail)) return;
    commit({ date: todayDDMON(), description: reason || "Goodwill adjustment", type: "Goodwill adj", miles: amount }, amount, true);
  }

  function submitTransfer() {
    var amount = Number($("transfer-amount").value) || 0;
    var a = selectedAccount();
    var detail = {
      action: "points-transfer",
      amount: amount,
      recipientAccountId: a ? a.id : null,
      recipientAccountAgeDays: a ? a.ageDays : null,
      agentManualCreditsToday: agent.manualCreditsToday,
      peerBaseline: agent.peerBaseline,
    };
    if (!PBX.dispatchBefore("pbx:beforeSubmit", detail)) return;
    commit(
      { date: todayDDMON(), description: "Mileage transfer → " + (a ? a.id : "?"), type: "Transfer", miles: -amount },
      -amount,
      false
    );
  }

  function submitRetro(decision) {
    var flightNo = $("retro-flight-no").value || "";
    var flightDate = $("retro-flight-date").value || "";
    var r = lookupRetro(flightNo);
    if (decision === "reject" && !$("retro-reject-reason").value.trim()) {
      $("retro-reject-reason").focus();
      return;
    }
    var detail = {
      action: "retro-claim",
      decision: decision,
      flightNo: flightNo,
      flightDate: flightDate,
      matchingFlightExists: r ? r.matchingFlightExists : false,
      daysSinceDeparture: r ? r.daysSinceDeparture : null,
      windowMin: 14,
      windowMax: 180,
      milesIfAccepted: r ? r.milesIfAccepted : 0,
    };
    if (!PBX.dispatchBefore("pbx:beforeSubmit", detail)) return;
    if (decision === "accept") {
      var miles = r ? r.milesIfAccepted : 0;
      commit({ date: todayDDMON(), description: "Retro claim " + flightNo, type: "Retro", miles: miles }, miles, true);
    } else {
      // Reject: no balance change; optional ledger note.
      commit(
        { date: todayDDMON(), description: "Retro rejected " + flightNo + " – " + $("retro-reject-reason").value, type: "Retro", miles: 0 },
        0,
        false
      );
    }
  }

  function submitRedemption() {
    var redeemType = $("redeem-type").value;
    var recipientType = $("redeem-recipient").value;
    var miles = Number($("redeem-miles").value) || 0;
    var acct = recipientType === "Other account" ? PBX.lookupAccount($("redeem-recipient-account").value) : null;
    var detail = {
      action: "redemption",
      redeemType: redeemType,
      recipientType: recipientType,
      recipientAccountId: acct ? acct.id : null,
      recipientAccountAgeDays: acct ? acct.ageDays : null,
      miles: miles,
    };
    if (!PBX.dispatchBefore("pbx:beforeSubmit", detail)) return;
    var desc = redeemType + (recipientType === "Other account" && acct ? " → " + acct.id : "");
    commit({ date: todayDDMON(), description: desc, type: "Redemption", miles: -miles }, -miles, false);
  }

  // --- Tabs / panels ---
  function wireTabs() {
    document.querySelectorAll(".tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        var name = tab.getAttribute("data-tab");
        document.querySelectorAll(".tab").forEach(function (t) { t.classList.toggle("active", t === tab); });
        document.querySelectorAll(".tabpanel").forEach(function (p) {
          p.hidden = p.getAttribute("data-tab") !== name;
        });
      });
    });
    document.querySelectorAll(".panel-head").forEach(function (head) {
      head.addEventListener("click", function (e) {
        if (e.target.closest(".hint")) return; // "Expand all" is cosmetic
        head.parentElement.classList.toggle("collapsed");
      });
    });
  }

  // --- Wiring ---
  function wire() {
    wireTabs();

    // Action segmented control
    $("action-seg").addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-action]");
      if (btn) setAction(btn.getAttribute("data-action"));
    });

    // Context-affecting inputs
    $("transfer-recipient").addEventListener("change", function () { syncContext(); validateTransfer(); });
    $("transfer-amount").addEventListener("input", function () { syncContext(); validateTransfer(); });
    $("adjust-amount").addEventListener("input", function () { syncContext(); validateGoodwill(); });
    $("adjust-reason").addEventListener("input", validateGoodwill);
    $("redeem-miles").addEventListener("input", syncContext);
    $("retro-flight-no").addEventListener("input", updateRetroStatus);
    $("redeem-recipient").addEventListener("change", function () {
      $("redeem-recipient-account-wrap").hidden = $("redeem-recipient").value !== "Other account";
      syncContext();
    });
    $("redeem-recipient-account").addEventListener("change", syncContext);

    // Submits
    $("btn-submit-goodwill-adjustment").addEventListener("click", submitGoodwill);
    $("btn-submit-points-transfer").addEventListener("click", submitTransfer);
    $("btn-accept-retro").addEventListener("click", function () { submitRetro("accept"); });
    $("btn-reject-retro").addEventListener("click", function () { submitRetro("reject"); });
    $("btn-submit-redemption").addEventListener("click", submitRedemption);

    // Cryptic window toggle (cosmetic)
    $("cryptic-toggle").addEventListener("click", function () {
      var box = $("cryptic-box");
      box.hidden = !box.hidden;
      if (!box.hidden) box.focus();
    });

    // Search (only the seeded member resolves; others no-op)
    $("member-search").addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      var q = $("member-search").value.trim().toLowerCase();
      if (!q) return;
      var hit = state.members.find(function (m) {
        return m.id.toLowerCase().indexOf(q) >= 0 ||
          (m.name.first + " " + m.name.last).toLowerCase().indexOf(q) >= 0 ||
          m.name.last.toLowerCase().indexOf(q) >= 0;
      });
      if (hit) { member = hit; renderHeader(); renderLedger(); syncContext(); }
    });
  }

  // --- Reset ---
  PBX.onReset(function () {
    state = PBX.clone(SEED);
    member = state.members[0];
    agent = state.agent;
    $("transfer-amount").value = "75000";
    $("adjust-amount").value = "";
    $("adjust-reason").value = "";
    $("retro-flight-no").value = "";
    $("retro-flight-date").value = "";
    $("retro-reject-reason").value = "";
    $("redeem-miles").value = "";
    renderHeader();
    renderCounter();
    renderRecipients();
    renderLedger();
    $("transfer-recipient").value = "#88231";
    setAction("transfer");
    updateRetroStatus();
  });
  PBX.wireResetButton("btn-reset");

  // --- Init: auto-load seeded member, transfer action pre-filled ---
  renderHeader();
  renderCounter();
  renderRecipients();
  renderLedger();
  $("transfer-recipient").value = "#88231";
  $("transfer-amount").value = "75000";
  wire();
  setAction("transfer");
  updateRetroStatus();
})();
