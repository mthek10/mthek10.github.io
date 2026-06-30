/*
 * pbx-contract.js — shared PixieBrix integration contract for all BLA demo apps.
 *
 * Sets up the window.PBX_DEMO namespace that every app and the PixieBrix mod
 * build against. This file contains NO guardrail logic — it only provides the
 * plumbing (namespace, context object, cancelable "before-action" helper, and
 * small utilities). All deciding/blocking belongs to the PixieBrix mod.
 *
 * Contract surface (see common/README.md for the full write-up):
 *   window.PBX_DEMO.data            -> seed data (set by each app's data.js)
 *   window.PBX_DEMO.context         -> live snapshot the mod evaluates
 *   window.PBX_DEMO.dispatchBefore(name, detail) -> boolean (proceeded?)
 *   window.PBX_DEMO.setContext(patch)
 *   window.PBX_DEMO.onReset(fn) / window.PBX_DEMO.reset()
 */
(function () {
  "use strict";

  var PBX = (window.PBX_DEMO = window.PBX_DEMO || {});

  // Seed data is assigned by each app's data.js; default to empty.
  PBX.data = PBX.data || {};

  // The live context object the mod reads. Each app overwrites/extends this.
  PBX.context = PBX.context || {};

  /**
   * Merge a patch into the live context object (in place, so existing
   * references stay valid) and return it.
   */
  PBX.setContext = function (patch) {
    if (patch) {
      Object.keys(patch).forEach(function (k) {
        PBX.context[k] = patch[k];
      });
    }
    return PBX.context;
  };

  /**
   * Dispatch a cancelable "before-action" CustomEvent on `document`.
   * The full payload is passed as event.detail. Returns `true` if the action
   * should PROCEED (event was not prevented) and `false` if a listener (the
   * mod) called preventDefault() to BLOCK it.
   */
  PBX.dispatchBefore = function (name, detail) {
    var ev = new CustomEvent(name, {
      bubbles: true,
      cancelable: true,
      detail: detail || {},
    });
    var proceeded = document.dispatchEvent(ev); // false if preventDefault() called
    return proceeded;
  };

  /**
   * Dispatch a non-cancelable notification event (e.g. for logging).
   */
  PBX.notify = function (name, detail) {
    document.dispatchEvent(
      new CustomEvent(name, { bubbles: true, cancelable: false, detail: detail || {} })
    );
  };

  // --- Reset plumbing ------------------------------------------------------
  // Apps register a reset handler that restores seed state in memory.
  var _resetHandlers = [];
  PBX.onReset = function (fn) {
    if (typeof fn === "function") _resetHandlers.push(fn);
  };
  PBX.reset = function () {
    _resetHandlers.forEach(function (fn) {
      try {
        fn();
      } catch (e) {
        console.error("PBX reset handler failed", e);
      }
    });
  };

  // --- Small utilities -----------------------------------------------------

  // Deep clone via JSON — seed data is plain JSON, so this is safe and gives
  // each Reset a pristine copy untouched by prior in-memory mutations.
  PBX.clone = function (obj) {
    return JSON.parse(JSON.stringify(obj));
  };

  PBX.formatMoney = function (n) {
    return (
      "$" +
      Number(n).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  };

  PBX.formatMiles = function (n) {
    var sign = n > 0 ? "+" : "";
    return sign + Number(n).toLocaleString();
  };

  // Wire a Reset button (by id) to PBX.reset() once the DOM is ready.
  PBX.wireResetButton = function (id) {
    var btn = document.getElementById(id || "btn-reset");
    if (btn) btn.addEventListener("click", PBX.reset);
  };
})();
