"use strict";

// Absicherung der öffentlichen Auslieferungsfläche:
// - index.html darf den E2E-Worker nicht fest laden (sonst 404/postMessage auf Pages)
// - e2e-loader.js lädt ihn nur im Iframe mit ?e2e=1 (lokale Fallback-Suite)
// - CI staged nur die Spiel-Dateien nach _site, nicht den ganzen Repo-Tree
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const loader = fs.readFileSync(path.join(root, "e2e-loader.js"), "utf8");
const workflow = fs.readFileSync(
  path.join(root, ".github", "workflows", "ci-pages.yml"),
  "utf8",
);

assert.ok(
  indexHtml.indexOf('src="tests/e2e-browser.js"') === -1,
  "index.html darf tests/e2e-browser.js nicht fest einbinden",
);
assert.ok(
  indexHtml.indexOf('src="e2e-loader.js"') !== -1,
  "index.html muss e2e-loader.js laden",
);
assert.ok(
  /window\.top\s*===\s*window/.test(loader),
  "e2e-loader.js muss Top-Level-Spiel als No-Op behandeln",
);
assert.ok(
  loader.indexOf('get("e2e")') !== -1,
  "e2e-loader.js darf den Worker nur bei ?e2e=1 nachladen",
);
assert.ok(
  loader.indexOf("tests/e2e-browser.js") !== -1,
  "e2e-loader.js muss den Worker-Pfad kennen",
);
assert.ok(
  /path:\s*_site/.test(workflow),
  "Pages-Artifact muss _site sein, nicht der Repo-Root",
);
assert.ok(
  workflow.indexOf("path: .") === -1,
  "Pages darf nicht den ganzen Checkout hochladen",
);
[
  "index.html",
  "style.css",
  "nim.js",
  "ai.js",
  "game.js",
  "e2e-loader.js",
].forEach(function (name) {
  assert.ok(
    workflow.indexOf(name) !== -1,
    "Pages-Staging muss " + name + " kopieren",
  );
});

console.log("deploy-surface: ok");
