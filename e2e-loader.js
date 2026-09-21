// e2e-loader.js – lädt den Browser-E2E-Worker nur im Test-Iframe.
//
// Top-Level (file:// oder GitHub Pages): No-Op, kein extra Fetch.
// tests/e2e-browser.html iframe't ../index.html?e2e=1 — dann wird
// tests/e2e-browser.js synchron per document.write eingefügt, damit der
// Parent nach dem iframe-load-Event postMessage senden kann (kein async-Race).
(function () {
  "use strict";
  if (window.top === window) {
    return;
  }
  const params = new URLSearchParams(window.location.search);
  if (params.get("e2e") !== "1") {
    return;
  }
  document.write('<script src="tests/e2e-browser.js"><\/script>');
})();
