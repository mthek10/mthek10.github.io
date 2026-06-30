/*
 * Consumer Services OMS app.js — shipping-address change is an agent exception.
 * Saves the edit in memory (even post-placement, billing mismatch, reused
 * address) — the PixieBrix mod listens for pbx:beforeSave to re-screen + block.
 */
(function () {
  "use strict";

  var PBX = window.PBX_DEMO;
  var SEED = PBX.clone(PBX.data);
  var state = PBX.clone(SEED);
  var currentOrderId = null;

  var $ = function (id) { return document.getElementById(id); };

  // Helper exposed on the contract: reuse count for an address (per agent).
  PBX.lookupAddressReuse = function (address) {
    var norm = (address || "").trim().toLowerCase();
    var hit = state.addressHistory.find(function (h) {
      return h.address.trim().toLowerCase() === norm;
    });
    return hit ? hit.reuseCountForAgent : 0;
  };

  function getOrder(id) {
    return state.orders.find(function (o) { return o.id === id; }) || null;
  }
  function addrEqual(a, b) {
    return (
      a.street.trim().toLowerCase() === b.street.trim().toLowerCase() &&
      a.zip.trim() === b.zip.trim()
    );
  }

  // --- Render ---
  $("agent-id").textContent = state.agent.id;

  function renderDetail() {
    var o = getOrder(currentOrderId);
    var box = $("order-detail");
    if (!o) {
      box.innerHTML = "";
      return;
    }

    var items = o.items
      .map(function (it) {
        return (
          "<tr><td>" + it.name +
          (it.isHyped ? ' <span class="badge hyped">Hyped</span>' : "") +
          '</td><td class="num">' + PBX.formatMoney(it.price) + "</td></tr>"
        );
      })
      .join("");

    var statusBadge =
      o.status === "PLACED"
        ? '<span class="badge placed">Placed</span>'
        : '<span class="badge shipped">Shipped</span>';

    box.innerHTML =
      '<div class="card" data-pbx-order-status="' + o.status + '" id="order-container">' +
        '<div class="card-head"><h2>Order ' + o.id + "</h2>" +
          '<div class="spacer"></div>' + statusBadge + "</div>" +
        '<div class="card-body stack">' +

          // Items
          '<table class="data"><thead><tr><th>Item</th><th class="num">Price</th></tr></thead>' +
          "<tbody>" + items + "</tbody></table>" +

          // Billing (read-only)
          '<div class="card" style="margin:0">' +
            '<div class="card-head"><h2>Billing Address (read-only)</h2></div>' +
            '<div class="card-body"><div class="mono">' +
              o.billingAddress.name + "<br>" + o.billingAddress.street + "<br>" +
              o.billingAddress.city + " " + o.billingAddress.zip +
            "</div></div>" +
          "</div>" +

          // Shipping (editable)
          '<div class="card" style="margin:0">' +
            '<div class="card-head"><h2>Shipping Address (editable)</h2></div>' +
            '<div class="card-body">' +
              '<div class="field"><label for="ship-name">Name</label>' +
                '<input id="ship-name" data-pbx-field="ship-name" value="' + esc(o.shippingAddress.name) + '" /></div>' +
              '<div class="field"><label for="ship-street">Street</label>' +
                '<input id="ship-street" data-pbx-field="ship-street" value="' + esc(o.shippingAddress.street) + '" /></div>' +
              '<div class="field-row">' +
                '<div class="field"><label for="ship-city">City</label>' +
                  '<input id="ship-city" data-pbx-field="ship-city" value="' + esc(o.shippingAddress.city) + '" /></div>' +
                '<div class="field"><label for="ship-zip">ZIP</label>' +
                  '<input id="ship-zip" data-pbx-field="ship-zip" value="' + esc(o.shippingAddress.zip) + '" /></div>' +
              "</div>" +
            "</div>" +
          "</div>" +

          // Discount + Save
          '<div class="field"><label for="order-discount">Discount (optional)</label>' +
            '<input id="order-discount" type="number" data-pbx-field="order-discount" placeholder="e.g. 25" /></div>' +
          '<div class="hint" id="save-hint"></div>' +
          '<button class="btn primary block" id="btn-save-order" data-pbx-action="save-order">Save Order</button>' +
        "</div>" +
      "</div>";

    ["ship-name", "ship-street", "ship-city", "ship-zip", "order-discount"].forEach(function (id) {
      $(id).addEventListener("input", syncContext);
    });
    $("btn-save-order").addEventListener("click", onSave);
    syncContext();
  }

  function esc(s) {
    return String(s).replace(/"/g, "&quot;");
  }

  // Read the editable shipping address from the form.
  function readForm() {
    return {
      name: $("ship-name").value,
      street: $("ship-street").value,
      city: $("ship-city").value,
      zip: $("ship-zip").value,
    };
  }

  function buildSnapshot() {
    var o = getOrder(currentOrderId);
    var newShip = readForm();
    var discountVal = Number($("order-discount").value) || 0;
    return {
      orderId: o.id,
      orderStatus: o.status,
      billingAddress: PBX.clone(o.billingAddress),
      oldShippingAddress: PBX.clone(o.shippingAddress),
      newShippingAddress: newShip,
      billingMismatch: !addrEqual(newShip, o.billingAddress),
      addressReuseCount: PBX.lookupAddressReuse(newShip.street),
      discountApplied: discountVal > 0 ? discountVal : null,
    };
  }

  function syncContext() {
    if (!getOrder(currentOrderId)) return;
    var snap = buildSnapshot();
    PBX.setContext(snap);
    var hint = $("save-hint");
    if (hint) {
      var bits = [];
      if (snap.billingMismatch) bits.push("billing mismatch");
      if (snap.addressReuseCount > 1) bits.push("address reused " + snap.addressReuseCount + "×");
      if (snap.discountApplied) bits.push("discount " + snap.discountApplied);
      hint.textContent = bits.length ? "Flags: " + bits.join(" · ") : "";
    }
  }

  // --- Save ---
  function onSave() {
    var o = getOrder(currentOrderId);
    if (!o) return;
    var snap = buildSnapshot();

    var proceed = PBX.dispatchBefore("pbx:beforeSave", snap);
    if (!proceed) return; // mod blocked → no change

    // Apply in memory.
    o.shippingAddress = snap.newShippingAddress;
    if (snap.discountApplied) o.discount = snap.discountApplied;
    syncContext();
    flash("Order saved.");
  }

  function flash(msg) {
    var hint = $("save-hint");
    if (hint) {
      hint.textContent = msg;
      hint.style.color = "var(--good)";
      setTimeout(function () {
        hint.style.color = "";
        syncContext();
      }, 1500);
    }
  }

  // --- Lookup ---
  function doLookup() {
    var id = ($("order-lookup").value || "").trim();
    var o = getOrder(id);
    if (!o) {
      $("lookup-hint").textContent = "No order found for “" + id + "”.";
      currentOrderId = null;
      renderDetail();
      return;
    }
    $("lookup-hint").textContent = "Try 100247 (PLACED) or 100312 (SHIPPED).";
    currentOrderId = id;
    renderDetail();
  }

  $("btn-lookup").addEventListener("click", doLookup);
  $("order-lookup").addEventListener("keydown", function (e) {
    if (e.key === "Enter") doLookup();
  });

  // --- Reset ---
  PBX.onReset(function () {
    state = PBX.clone(SEED);
    currentOrderId = null;
    $("order-lookup").value = "";
    $("lookup-hint").textContent = "Try 100247 (PLACED) or 100312 (SHIPPED).";
    renderDetail();
    PBX.setContext({});
  });
  PBX.wireResetButton("btn-reset");
})();
