/*
 * OrderDesk app.js — adidas-style OMS cart console with manual discount override.
 * Applies any discount (even absurd: >cap, >item, on gift cards, stack-to-zero)
 * — the PixieBrix mod listens for pbx:beforeApply to enforce the team's rules.
 */
(function () {
  "use strict";

  var PBX = window.PBX_DEMO;
  var SEED = PBX.clone(PBX.data);
  var state = PBX.clone(SEED);
  var selected = {}; // line index -> true

  var SHIPPING = 5.0; // flat estimated shipping, like Omobo
  var TAX = 0.0;

  var $ = function (id) { return document.getElementById(id); };

  // Inline product thumbnails (no external assets).
  var STRIPES =
    '<svg class="stripes" viewBox="0 0 40 28" fill="currentColor"><polygon points="0,28 6,28 13,16 7,16"/><polygon points="10,28 16,28 26,9 20,9"/><polygon points="20,28 26,28 39,2 33,2"/></svg>';
  var CARD_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>';

  // --- Discount model ---------------------------------------------------
  // Order discount: a single % (state.order.discountPct) applied to every line
  //   that does NOT have an individual override. Re-applying replaces it.
  // Item override: li.overridePrice (a new unit price) takes precedence over the
  //   order discount for that line.
  // All discounts are computed from the original unit price.
  function orderPct() { return state.order.discountPct || 0; }
  function lineGross(li) { return li.unitPrice * li.qty; } // original price
  function lineNet(li) {
    if (li.overridePrice != null) return li.overridePrice * li.qty; // item override wins
    return lineGross(li) * (1 - orderPct() / 100); // else order discount
  }
  function lineDiscount(li) { return lineGross(li) - lineNet(li); }
  function subtotal() {
    return state.order.lineItems.reduce(function (s, li) { return s + lineGross(li); }, 0);
  }
  function totalDiscount() {
    return state.order.lineItems.reduce(function (s, li) { return s + lineDiscount(li); }, 0);
  }
  function merchTotal() {
    return state.order.lineItems.reduce(function (s, li) { return s + lineNet(li); }, 0);
  }
  // Hypothetical merch total if the order discount were `pct` (overrides unchanged).
  function merchTotalWith(pct) {
    return state.order.lineItems.reduce(function (s, li) {
      var net = li.overridePrice != null ? li.overridePrice * li.qty : lineGross(li) * (1 - pct / 100);
      return s + net;
    }, 0);
  }
  function hasGiftCardLine() {
    return state.order.lineItems.some(function (li) { return li.type === "giftcard"; });
  }
  function round2(n) { return Math.round(n * 100) / 100; }

  function initLineState() {
    if (state.order.discountPct == null) state.order.discountPct = 0;
    state.order.lineItems.forEach(function (li) {
      if (!("overridePrice" in li)) li.overridePrice = null;
    });
  }

  // --- Header / profile ---
  function renderChrome() {
    $("case-id").textContent = state.case.id;
    $("athlete-name").textContent = state.agent.name;
    $("tier-cap").textContent = state.agent.tierCapPct + "%";
    $("cust-name").textContent = state.customer.name;
    $("cust-email").textContent = state.customer.email;
    $("cust-member").textContent = state.customer.memberId;
  }

  // --- Cart rows ---
  function renderCart() {
    $("cart-count").textContent = state.order.lineItems.length;

    $("line-items").innerHTML = state.order.lineItems
      .map(function (li, i) {
        var isGift = li.type === "giftcard";
        var struck =
          li.listPrice && li.listPrice > li.unitPrice
            ? '<div class="list-price">' + PBX.formatMoney(li.listPrice * li.qty) + "</div>"
            : "";
        var lineDisc = lineDiscount(li);
        var discTag =
          lineDisc > 0.005
            ? '<span class="disc-tag">−' + PBX.formatMoney(lineDisc) + "</span>"
            : "";

        var sizeCtrl = isGift
          ? ""
          : '<div class="ctrl size"><label>Size</label><select data-size-index="' + i + '">' +
            li.sizeOptions
              .map(function (s) {
                return '<option' + (s === li.size ? " selected" : "") + ">" + s + "</option>";
              })
              .join("") +
            "</select></div>";

        var qtyOpts = "";
        for (var q = 1; q <= 10; q++) {
          qtyOpts += '<option value="' + q + '"' + (q === li.qty ? " selected" : "") + ">" + q + "</option>";
        }

        return (
          '<div class="cart-row' + (selected[i] ? " selected" : "") + '" data-pbx-line data-pbx-line-index="' + i +
            '" data-pbx-product-type="' + li.type + '" data-pbx-unit-price="' + li.unitPrice + '">' +
            '<input type="checkbox" class="row-select" data-sel-index="' + i + '"' +
              (selected[i] ? " checked" : "") + " />" +
            '<div class="thumb' + (isGift ? " giftcard" : "") + '">' + (isGift ? CARD_ICON : STRIPES) + "</div>" +
            '<div class="row-main">' +
              '<div class="row-top">' +
                "<div>" +
                  '<div class="prod-name">' + li.name + "</div>" +
                  '<div class="prod-meta">' + li.sku + "</div>" +
                  '<div class="prod-meta">' + li.desc + "</div>" +
                  '<div class="prod-meta">' + li.color + "</div>" +
                "</div>" +
                '<div class="price-box">' + struck +
                  '<div class="cur-price">' + PBX.formatMoney(lineNet(li)) + discTag + "</div>" +
                "</div>" +
              "</div>" +
              '<div class="row-controls">' + sizeCtrl +
                '<div class="ctrl"><label>Quantity</label><select data-qty-index="' + i + '">' + qtyOpts + "</select></div>" +
                '<button class="more-than" type="button">MORE THAN 10?</button>' +
              "</div>" +
              '<div class="row-links">' +
                '<a class="visit-shop">Visit shop</a>' +
                '<a class="add-disc" data-line="' + i + '">Add Discount</a>' +
                '<a class="remove-item" data-line="' + i + '">Remove Item</a>' +
              "</div>" +
              // Item-level price override — set the new item price to anything.
              '<div class="item-disc" data-disc-index="' + i + '" hidden>' +
                '<label for="item-new-price-' + i + '">New item price</label>' +
                '<input type="number" id="item-new-price-' + i + '" class="item-price-input" data-pbx-field="item-new-price" min="0" step="0.01" placeholder="e.g. 99.99" />' +
                '<button type="button" id="btn-set-price-' + i + '" class="item-price-apply" data-pbx-action="apply-item-price">Set price</button>' +
                '<button type="button" id="btn-cancel-price-' + i + '" class="item-price-cancel">Cancel</button>' +
              "</div>" +
            "</div>" +
          "</div>" +
          (i < state.order.lineItems.length - 1 ? '<hr class="cart-rule" />' : "")
        );
      })
      .join("");

    refreshSelection();
  }

  // --- Totals ---
  function renderTotals() {
    var disc = totalDiscount();
    var sub = subtotal();
    var shipping = state.order.lineItems.length ? SHIPPING : 0;
    var orderTotal = sub - disc + shipping + TAX;
    $("tot-subtotal").textContent = PBX.formatMoney(sub);
    $("tot-discount").textContent = PBX.formatMoney(disc);
    $("tot-shipping").textContent = PBX.formatMoney(shipping);
    $("tot-ship-discount").textContent = PBX.formatMoney(0);
    $("tot-tax").textContent = PBX.formatMoney(TAX);
    $("tot-order-total").textContent = PBX.formatMoney(orderTotal);
    $("tot-amount-due").textContent = PBX.formatMoney(orderTotal);
  }

  // --- Live context (baseline; apply functions pass their own detail) ---
  function syncContext(extra) {
    PBX.setContext(
      Object.assign(
        {
          agentTierCapPct: state.agent.tierCapPct,
          targetLine: null,
          discountPct: 0,
          discountAmt: 0,
          orderTotalBefore: round2(merchTotal()),
          orderTotalAfter: round2(merchTotal()),
          customerCodesInWindow: state.customer.codesInWindow,
          hasGiftCardLine: hasGiftCardLine(),
        },
        extra || {}
      )
    );
  }

  // --- Cart Actions: whole-order % discount (single value; re-applying replaces) ---
  function applyOrderDiscount() {
    var pct = Number($("discount-value").value) || 0;
    var before = merchTotal();
    var after = merchTotalWith(pct);
    // Order discount amount = what it takes off lines WITHOUT an item override.
    var orderDiscAmt = state.order.lineItems.reduce(function (s, li) {
      return s + (li.overridePrice != null ? 0 : lineGross(li) * (pct / 100));
    }, 0);
    var detail = {
      agentTierCapPct: state.agent.tierCapPct,
      scope: "order",
      targetLine: null,
      discountPct: round2(pct),
      discountAmt: round2(orderDiscAmt),
      orderTotalBefore: round2(before),
      orderTotalAfter: round2(after),
      customerCodesInWindow: state.customer.codesInWindow,
      hasGiftCardLine: hasGiftCardLine(),
    };
    syncContext(detail);

    if (!PBX.dispatchBefore("pbx:beforeApply", detail)) return; // mod blocked

    state.order.discountPct = pct; // REPLACE the single order discount
    state.customer.codesInWindow += 1;
    $("discount-form").hidden = true;
    renderCart();
    renderTotals();
    syncContext();
  }

  // --- Item level: set a new item price (any value). Overrides the order
  //     discount for this line only. ---
  function applyItemPrice(index) {
    var li = state.order.lineItems[index];
    if (!li) return;
    var editor = document.querySelector('.item-disc[data-disc-index="' + index + '"]');
    var input = editor.querySelector(".item-price-input");
    if (input.value.trim() === "") { input.focus(); return; }
    var newUnit = Number(input.value);
    if (isNaN(newUnit) || newUnit < 0) { input.focus(); return; }

    var gross = lineGross(li);
    var newNet = newUnit * li.qty;
    var discountAmt = gross - newNet; // discount off ORIGINAL price (negative if raised)
    var before = merchTotal();
    var after = state.order.lineItems.reduce(function (s, l, j) {
      return s + (j === index ? newNet : lineNet(l));
    }, 0);
    var detail = {
      agentTierCapPct: state.agent.tierCapPct,
      scope: "item",
      lineIndex: index,
      newItemPrice: round2(newUnit),
      targetLine: { type: li.type, unitPrice: li.unitPrice },
      discountPct: round2(gross > 0 ? (discountAmt / gross) * 100 : 0),
      discountAmt: round2(discountAmt),
      orderTotalBefore: round2(before),
      orderTotalAfter: round2(after),
      customerCodesInWindow: state.customer.codesInWindow,
      hasGiftCardLine: hasGiftCardLine(),
    };
    syncContext(detail);

    if (!PBX.dispatchBefore("pbx:beforeApply", detail)) return; // mod blocked

    li.overridePrice = newUnit; // individual override (wins over order discount)
    state.customer.codesInWindow += 1;
    renderCart();
    renderTotals();
    syncContext();
  }

  // --- Selection (REMOVE SELECTED ITEMS) ---
  function refreshSelection() {
    var n = Object.keys(selected).filter(function (k) { return selected[k]; }).length;
    $("sel-count").textContent = n;
    var btn = $("btn-remove-selected");
    btn.classList.toggle("enabled", n > 0);
    btn.disabled = n === 0;
  }

  // --- Cart Actions order-discount form reveal ---
  function showOrderDiscountForm() {
    document.querySelectorAll(".item-disc").forEach(function (x) { x.hidden = true; });
    $("discount-form").hidden = false;
    syncContext();
  }

  // --- Item-level price editor reveal ---
  function toggleItemEditor(index) {
    var ed = document.querySelector('.item-disc[data-disc-index="' + index + '"]');
    if (!ed) return;
    var willShow = ed.hidden;
    document.querySelectorAll(".item-disc").forEach(function (x) { x.hidden = true; });
    ed.hidden = !willShow;
    if (willShow) {
      var li = state.order.lineItems[index];
      var inp = ed.querySelector(".item-price-input");
      inp.value = (lineNet(li) / li.qty).toFixed(2); // prefill current effective price
      inp.focus();
      inp.select();
    }
  }

  // --- Wiring (event-delegated where rows re-render) ---
  function wire() {
    // Cart Actions buttons both reveal the order % discount form
    $("btn-add-discount").addEventListener("click", showOrderDiscountForm);
    $("btn-add-promo").addEventListener("click", showOrderDiscountForm);
    $("btn-apply-discount").addEventListener("click", applyOrderDiscount);

    // Delegated cart interactions
    $("line-items").addEventListener("click", function (e) {
      var addDisc = e.target.closest(".add-disc");
      if (addDisc) { toggleItemEditor(Number(addDisc.getAttribute("data-line"))); return; }
      var priceApply = e.target.closest(".item-price-apply");
      if (priceApply) { applyItemPrice(Number(priceApply.closest(".item-disc").getAttribute("data-disc-index"))); return; }
      var priceCancel = e.target.closest(".item-price-cancel");
      if (priceCancel) { priceCancel.closest(".item-disc").hidden = true; return; }
      var removeItem = e.target.closest(".remove-item");
      if (removeItem) { removeLine(Number(removeItem.getAttribute("data-line"))); return; }
    });
    $("line-items").addEventListener("change", function (e) {
      var sel = e.target.closest(".row-select");
      if (sel) {
        selected[sel.getAttribute("data-sel-index")] = sel.checked;
        var row = sel.closest(".cart-row");
        if (row) row.classList.toggle("selected", sel.checked);
        refreshSelection();
        return;
      }
      var qty = e.target.closest("select[data-qty-index]");
      if (qty) {
        state.order.lineItems[Number(qty.getAttribute("data-qty-index"))].qty = Number(qty.value);
        renderTotals();
        renderCart();
        syncContext();
        return;
      }
      var size = e.target.closest("select[data-size-index]");
      if (size) { state.order.lineItems[Number(size.getAttribute("data-size-index"))].size = size.value; }
    });

    $("btn-remove-selected").addEventListener("click", function () {
      var keep = state.order.lineItems.filter(function (li, i) { return !selected[i]; });
      state.order.lineItems = keep;
      selected = {};
      renderCart();
      renderTotals();
      syncContext();
    });

    // Checkout / shipping-address step
    $("btn-checkout").addEventListener("click", openCheckout);
    $("back-to-cart").addEventListener("click", openCartFromCheckout);
    $("confirm-back").addEventListener("click", openCartFromCheckout);
    $("btn-place-order").addEventListener("click", placeOrder);
    document.querySelectorAll(".addr-chip").forEach(function (c) {
      c.addEventListener("click", function () { fillAddress(c.getAttribute("data-addr")); });
    });
    ["ship-name", "ship-street", "ship-apt", "ship-city", "ship-zip", "ship-email", "ship-phone"].forEach(function (id) {
      $(id).addEventListener("input", function () {
        document.querySelectorAll(".addr-chip").forEach(function (c) { c.classList.remove("active"); });
        syncCheckout();
      });
    });
    $("ship-state").addEventListener("change", syncCheckout);
  }

  function openCartFromCheckout() {
    showView("cart");
  }

  function removeLine(index) {
    state.order.lineItems.splice(index, 1);
    selected = {};
    renderCart();
    renderTotals();
    syncContext();
  }

  // --- Checkout / shipping-address step ---------------------------------
  // The app stays "dumb": it lets any address through and only exposes the
  // fraud signal (context + data-pbx-known-fraud). The PixieBrix layer blocks.

  // Helper the mod can also call directly.
  PBX.lookupFraud = function (street) {
    var norm = (street || "").trim().toLowerCase();
    return (
      (state.fraudAddresses || []).find(function (f) {
        return f.street.trim().toLowerCase() === norm;
      }) || null
    );
  };

  function shipVal(id) { return ($(id).value || "").trim(); }
  function readShip() {
    return {
      name: shipVal("ship-name"),
      street: shipVal("ship-street"),
      apt: shipVal("ship-apt"),
      city: shipVal("ship-city"),
      state: $("ship-state").value,
      zip: shipVal("ship-zip"),
      email: shipVal("ship-email"),
      phone: shipVal("ship-phone"),
    };
  }

  function checkoutOrderTotal() {
    return round2(subtotal() - totalDiscount() + (state.order.lineItems.length ? SHIPPING : 0));
  }

  function showView(name) {
    $("cart-view").hidden = name !== "cart";
    $("checkout-view").hidden = name !== "checkout";
    $("confirm-view").hidden = name !== "confirm";
    window.scrollTo(0, 0);
  }

  function fillAddress(which) {
    var a = which === "recent" ? state.fraudAddresses[0] : state.shipping.onFile;
    $("ship-name").value = a.name || state.customer.name;
    $("ship-street").value = a.street || "";
    $("ship-apt").value = a.apt || "";
    $("ship-city").value = a.city || "";
    $("ship-state").value = a.state || "CA";
    $("ship-zip").value = a.zip || "";
    $("ship-email").value = a.email || state.customer.email;
    $("ship-phone").value = a.phone || state.shipping.onFile.phone;
    document.querySelectorAll(".addr-chip").forEach(function (c) {
      c.classList.toggle("active", c.getAttribute("data-addr") === which);
    });
    syncCheckout();
  }

  function syncCheckout() {
    var ship = readShip();
    var fraud = PBX.lookupFraud(ship.street);
    var known = !!fraud;
    var form = $("checkout-form");
    form.setAttribute("data-pbx-known-fraud", String(known));
    form.setAttribute("data-pbx-address-reuse-count", String(fraud ? fraud.reuseCount : 0));
    PBX.setContext({
      checkout: {
        orderId: state.order.id,
        orderTotal: checkoutOrderTotal(),
        shippingAddress: ship,
        knownFraudAddress: known,
        addressReuseCount: fraud ? fraud.reuseCount : 0,
        fraudReason: fraud ? fraud.reason : null,
      },
    });
  }

  function renderCheckoutSummary() {
    $("co-subtotal").textContent = PBX.formatMoney(subtotal());
    $("co-discount").textContent = PBX.formatMoney(totalDiscount());
    $("co-shipping").textContent = PBX.formatMoney(state.order.lineItems.length ? SHIPPING : 0);
    $("co-total").textContent = PBX.formatMoney(checkoutOrderTotal());
    $("summary-items").innerHTML = state.order.lineItems
      .map(function (li) {
        return (
          '<div class="summary-line"><span class="nm">' + li.name + " × " + li.qty +
          '</span><span class="pr">' + PBX.formatMoney(lineNet(li)) + "</span></div>"
        );
      })
      .join("");
  }

  function openCheckout() {
    fillAddress("onfile");
    renderCheckoutSummary();
    showView("checkout");
  }

  function placeOrder() {
    var ship = readShip();
    var fraud = PBX.lookupFraud(ship.street);
    syncCheckout();
    var detail = {
      orderId: state.order.id,
      orderTotal: checkoutOrderTotal(),
      shippingAddress: ship,
      knownFraudAddress: !!fraud,
      addressReuseCount: fraud ? fraud.reuseCount : 0,
      fraudReason: fraud ? fraud.reason : null,
      customerId: state.customer.id,
    };

    // The PixieBrix layer may preventDefault() here to BLOCK a fraud address.
    var proceed = PBX.dispatchBefore("pbx:beforeCheckout", detail);
    if (!proceed) return; // blocked → stay on the checkout form, no order placed

    $("confirm-sub").textContent =
      "Order " + state.order.id + " · shipping to " + ship.street +
      ", " + ship.city + ", " + ship.state + " " + ship.zip;
    showView("confirm");
  }

  // --- Reset ---
  PBX.onReset(function () {
    state = PBX.clone(SEED);
    selected = {};
    initLineState();
    $("discount-value").value = "5";
    $("discount-form").hidden = true;
    renderChrome();
    renderCart();
    renderTotals();
    syncContext();
    // Return to cart view and clear the checkout address fields
    ["ship-name", "ship-street", "ship-apt", "ship-city", "ship-zip", "ship-email", "ship-phone"].forEach(function (id) {
      var el = $(id);
      if (el) el.value = "";
    });
    document.querySelectorAll(".addr-chip").forEach(function (c) { c.classList.remove("active"); });
    showView("cart");
  });
  PBX.wireResetButton("btn-reset");

  // --- Init ---
  initLineState();
  renderChrome();
  renderCart();
  renderTotals();
  wire();
  syncContext();
})();
