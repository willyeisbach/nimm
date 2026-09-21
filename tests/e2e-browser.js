/*
 * NIMM! Browser-E2E-Suite
 *
 * Classic, dependency-free file:// runner. The top-level runner cannot read a
 * file:// iframe in every Chromium configuration, so the actual assertions run
 * inside the real index.html document and report via postMessage. The parent
 * still creates and destroys one fresh iframe per scenario.
 */
(function () {
  "use strict";

  var scenarioNames = [
    "Initiale Wartephase vor Los!",
    "Optionen und Regelhinweis",
    "Mensch-Start: Markieren und „Nimm!“-Bestätigung",
    "KI-Start: Denkblase, Lock und KI-Zug",
    "Ungültiger Tap: Haufenfeedback ohne Markierung",
    "Neue Auswahl ersetzt / Escape bricht ab",
    "Leerer Haufen, Sieg-Overlay und Neustart",
  ];

  function assert(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }

  function sameArray(actual, expected, label) {
    var a = JSON.stringify(actual);
    var e = JSON.stringify(expected);
    assert(a === e, label + ": erwartet " + e + ", erhalten " + a);
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  async function waitUntil(predicate, timeout, label) {
    var end = Date.now() + (timeout || 5000);
    while (Date.now() < end) {
      if (predicate()) {
        return;
      }
      await sleep(40);
    }
    throw new Error("Timeout: " + (label || "erwarteter Zustand"));
  }

  function setInput(doc, selector, value) {
    var input = doc.querySelector(selector);
    assert(input, "Feld fehlt: " + selector);
    input.value = String(value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function chooseRadio(doc, name, value) {
    var input = doc.querySelector(
      'input[name="' + name + '"][value="' + value + '"]',
    );
    assert(input, "Radio fehlt: " + name + "=" + value);
    input.checked = true;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function click(doc, selector) {
    var element = doc.querySelector(selector);
    assert(element, "Element fehlt: " + selector);
    element.click();
    return element;
  }

  function pointerTap(app, stoneIndex, heapIndex) {
    var win = app.win;
    var doc = app.doc;
    assert(
      typeof win.PointerEvent === "function",
      "Browser unterstützt keine PointerEvent-Taps",
    );
    var heap = doc.querySelector(
      '.heap[data-heap-index="' + (heapIndex || 0) + '"]',
    );
    assert(heap, "Zielhaufen fehlt");
    var stone = heap.querySelectorAll(".stone")[stoneIndex];
    assert(stone, "Rosine " + (stoneIndex + 1) + " fehlt");
    var rect = stone.getBoundingClientRect();
    var init = {
      bubbles: true,
      cancelable: true,
      pointerId: 17,
      pointerType: "mouse",
      isPrimary: true,
      clientX: Math.round(rect.left + rect.width / 2),
      clientY: Math.round(rect.top + rect.height / 2),
      buttons: 1,
    };
    stone.dispatchEvent(new win.PointerEvent("pointerdown", init));
    doc.dispatchEvent(
      new win.PointerEvent("pointerup", {
        bubbles: true,
        cancelable: true,
        pointerId: 17,
        pointerType: "mouse",
        isPrimary: true,
        clientX: init.clientX,
        clientY: init.clientY,
        buttons: 0,
      }),
    );
  }

  async function openConfiguredApp(options) {
    var app = { win: window, doc: document };
    click(app.doc, "#options-btn");
    assert(
      app.doc.querySelector("#options-dialog").hidden === false,
      "Optionsdialog öffnet nicht",
    );
    setInput(app.doc, "#opt-max-heaps", options.maxHeaps || 1);
    setInput(app.doc, "#opt-max-stones", options.maxStones);
    setInput(app.doc, "#opt-min-stones", options.minStones);
    setInput(app.doc, "#opt-name1", options.name1 || "Lina");
    setInput(
      app.doc,
      "#opt-name2",
      options.name2 ||
        (options.opponent === "Mensch" ? "Mia" : options.opponent),
    );
    chooseRadio(app.doc, "opt-rule", options.rule || "4er");
    if (options.rule === "own") {
      setInput(app.doc, "#opt-own-list", options.ownList || "1,3");
    }
    chooseRadio(app.doc, "opt-opponent", options.opponent || "Mensch");
    chooseRadio(app.doc, "opt-start", options.start || "1");
    click(app.doc, "#opt-apply");
    await waitUntil(
      function () {
        return window.Game.state.awaitingStart === true;
      },
      1500,
      "neue Runde nach Optionen",
    );
    sameArray(
      window.Game.state.heaps,
      [options.minStones],
      "deterministische Haufengröße",
    );
    return app;
  }

  function cleanupApp() {
    if (!window.Game) {
      return;
    }
    window.Game._moveSeq = (window.Game._moveSeq || 0) + 1;
    if (typeof window.Game.cancelAIMove === "function") {
      window.Game.cancelAIMove();
    }
    if (window.Game._animTimer !== undefined) {
      window.clearTimeout(window.Game._animTimer);
    }
    document.querySelectorAll(".heap").forEach(function (heap) {
      if (heap._feedbackTimer !== undefined) {
        window.clearTimeout(heap._feedbackTimer);
      }
    });
    if (typeof window.stop === "function") {
      window.stop();
    }
  }

  async function testInitialWaiting() {
    var app = { win: window, doc: document };
    var before = app.win.Game.state.heaps.slice();
    assert(
      app.win.Game.state.awaitingStart === true,
      "Runde wartet nicht auf Los!",
    );
    assert(
      app.doc.querySelector("#start-overlay").hidden === false,
      "Startpanel ist unsichtbar",
    );
    assert(app.doc.querySelector("#start-go-btn"), "Los!-Button fehlt");
    pointerTap(app, 2, 0);
    await sleep(80);
    sameArray(
      app.win.Game.state.heaps,
      before,
      "Tap vor Los! verändert Haufen",
    );
    assert(
      app.win.Game.state.lastMove === null,
      "Tap vor Los! erzeugt einen Zug",
    );
    assert(
      app.win.Game.state.selectedAmount === null,
      "Tap vor Los! markiert keine Menge",
    );
    assert(
      app.doc.querySelector("#take-btn").disabled === true,
      "„Nimm!“ ist vor Los! nicht aktiv",
    );
  }

  async function testOptionsAndRuleHint() {
    var app = await openConfiguredApp({
      minStones: 3,
      maxStones: 3,
      rule: "own",
      ownList: "1,3",
      opponent: "Mensch",
      start: "1",
    });
    assert(
      app.win.Game.state.rule === "own",
      "Regel own wurde nicht übernommen",
    );
    sameArray(
      app.win.Game.state.allowed,
      [1, 3],
      "Eigene Liste wird sortiert/übernommen",
    );
    var hint = app.doc.querySelector("#rule-hint").textContent;
    assert(
      hint.indexOf("1 oder 3") !== -1 &&
        hint.indexOf("Wer die letzte nimmt, gewinnt!") !== -1,
      "Regelhinweis nennt nicht Liste und Gewinnregel: " + hint,
    );
    assert(
      app.doc.querySelector("#options-dialog").hidden === true,
      "Optionsdialog bleibt offen",
    );
    assert(
      app.doc.querySelector("#start-overlay").hidden === false,
      "Optionen starten keine wartende Runde",
    );
  }

  async function testHumanPointerTap() {
    var app = await openConfiguredApp({
      minStones: 4,
      maxStones: 4,
      rule: "4er",
      opponent: "Mensch",
      start: "1",
    });
    click(app.doc, "#start-go-btn");
    assert(
      app.win.Game.state.awaitingStart === false,
      "Los! gibt Runde nicht frei",
    );
    var takeBtn = app.doc.querySelector("#take-btn");
    assert(takeBtn, "„Nimm!“-Button fehlt in der Aktionsleiste");
    assert(takeBtn.disabled === true, "„Nimm!“ ist ohne Auswahl nicht aktiv");
    // Schritt 1: Pointer-Tipp auf die dritte Rosine = MARKIEREN.
    pointerTap(app, 2, 0);
    await sleep(80);
    sameArray(
      app.win.Game.state.heaps,
      [4],
      "Schritt 1 nimmt noch keine Rosine weg",
    );
    assert(
      app.win.Game.state.selectedAmount === 3,
      "Schritt 1 markiert nicht die Menge 3",
    );
    assert(
      app.win.Game.state.lock === false,
      "Schritt 1 darf keinen Lock setzen",
    );
    assert(takeBtn.disabled === false, "Schritt 1 schaltet „Nimm!“ nicht frei");
    var marked = app.doc.querySelector(
      '.heap[data-heap-index="0"] .stone.selected',
    );
    assert(
      app.doc.querySelectorAll('.heap[data-heap-index="0"] .stone.selected')
        .length === 3,
      "Schritt 1 markiert nicht genau drei Rosinen",
    );
    assert(
      marked && marked.getBoundingClientRect,
      "Markierung ist ein echtes DOM-Element",
    );
    assert(
      app.win.Game.state.lastMove === null,
      "Schritt 1 erzeugt keinen Zug",
    );
    // Schritt 2: „Nimm!“ = ZUG.
    var before = app.win.Game.state.heaps.slice();
    takeBtn.click();
    assert(
      app.win.Game.state.lock === true,
      "Schritt 2 startet keine Entfernungsanimation",
    );
    await waitUntil(
      function () {
        return app.win.Game.state.lock === false;
      },
      4000,
      "Mensch-Animation",
    );
    sameArray(
      app.win.Game.state.heaps,
      [1],
      "Schritt 2 nimmt nicht genau drei Rosinen",
    );
    assert(
      before[0] === 4 && app.win.Game.state.heaps[0] === 1,
      "Schritt 2 entfernt genau 3 von 4",
    );
    assert(
      app.win.Game.state.lastMove && app.win.Game.state.lastMove.player === 1,
      "Schritt 2 hinterlegt nicht Spieler 1 als letzten Zug",
    );
    assert(
      app.win.Game.state.lastMove.amount === 3,
      "Schritt 2 hinterlegt nicht Menge 3",
    );
    assert(
      app.win.Game.state.selectedAmount === null,
      "Schritt 2 räumt die Markierung nicht ab",
    );
    assert(takeBtn.disabled === true, "Schritt 2 sperrt „Nimm!“ nicht wieder");
    assert(
      app.doc.querySelectorAll(".heap .stone").length === 1,
      "DOM zeigt nicht eine verbleibende Rosine",
    );
  }

  async function testAIStart() {
    var app = await openConfiguredApp({
      minStones: 3,
      maxStones: 3,
      rule: "4er",
      opponent: "Baxi",
      start: "2",
    });
    assert(app.win.Game.state.active === 2, "KI ist nicht Startspieler");
    assert(
      app.win.Game.state.lock === false,
      "vor Los! ist die KI unerwartet gesperrt",
    );
    var before = app.win.Game.state.heaps.slice();
    await sleep(180);
    sameArray(app.win.Game.state.heaps, before, "KI verändert Haufen vor Los!");
    click(app.doc, "#start-go-btn");
    assert(app.win.Game.state.lock === true, "nach Los! setzt KI keinen Lock");
    assert(
      app.win.Game.state.bubble[2] === "…denkt…",
      "KI zeigt keine Denkblase",
    );
    sameArray(
      app.win.Game.state.heaps,
      [3],
      "KI zieht synchron statt nach Denkpause",
    );
    await waitUntil(
      function () {
        return (
          app.win.Game.state.lastMove &&
          app.win.Game.state.lastMove.player === 2 &&
          app.win.Game.state.lock === false
        );
      },
      6000,
      "KI-Zug",
    );
    assert(app.win.Game.state.heaps[0] < 3, "KI-Zug entfernt keine Rosinen");
  }

  async function testInvalidTap() {
    var app = await openConfiguredApp({
      minStones: 3,
      maxStones: 3,
      rule: "own",
      ownList: "1,3",
      opponent: "Mensch",
      start: "1",
    });
    click(app.doc, "#start-go-btn");
    pointerTap(app, 1, 0);
    await sleep(80);
    sameArray(
      app.win.Game.state.heaps,
      [3],
      "ungültiger Tap verändert den Haufen",
    );
    assert(
      app.win.Game.state.active === 1 && app.win.Game.state.lastMove === null,
      "ungültiger Tap erzeugt trotzdem einen Zug",
    );
    assert(
      app.win.Game.state.selectedAmount === null,
      "ungültiger Tap markiert keine Menge",
    );
    var takeBtn = app.doc.querySelector("#take-btn");
    assert(takeBtn.disabled === true, "ungültiger Tap schaltet „Nimm!“ frei");
    var heap = app.doc.querySelector('.heap[data-heap-index="0"]');
    var feedback = heap.querySelector(".heap-feedback");
    assert(
      feedback && feedback.textContent === "Nur 1, 3 Steine!",
      "Haufenfeedback nennt die erlaubten Mengen nicht: " +
        (feedback && feedback.textContent),
    );
    assert(
      heap.classList.contains("heap--shake"),
      "Haufenfeedback schüttelt den Haufen nicht",
    );
    await waitUntil(
      function () {
        return !heap.querySelector(".heap-feedback");
      },
      2500,
      "Feedback-Aufräumen",
    );
  }

  async function testSelectReplaceAndCancel() {
    var app = await openConfiguredApp({
      minStones: 4,
      maxStones: 4,
      rule: "4er",
      opponent: "Mensch",
      start: "1",
    });
    click(app.doc, "#start-go-btn");
    assert(
      app.win.Game.state.awaitingStart === false,
      "Los! gibt Runde nicht frei",
    );
    var takeBtn = app.doc.querySelector("#take-btn");
    // Markierung 3 → Markierung 1: die neue Auswahl ERSETZT die alte.
    pointerTap(app, 2, 0);
    await sleep(60);
    assert(
      app.win.Game.state.selectedAmount === 3,
      "erst Markierung ist nicht 3",
    );
    assert(
      app.doc.querySelectorAll('.heap[data-heap-index="0"] .stone.selected')
        .length === 3,
      "erst Markierung zeigt nicht 3 Steine",
    );
    pointerTap(app, 0, 0);
    await sleep(60);
    assert(
      app.win.Game.state.selectedAmount === 1,
      "zweite Markierung ersetzt nicht die erste",
    );
    assert(
      app.doc.querySelectorAll('.heap[data-heap-index="0"] .stone.selected')
        .length === 1,
      "zweite Markierung zeigt nicht genau 1 Stein",
    );
    assert(
      takeBtn.disabled === false,
      "„Nimm!“ ist bei neuer Markierung nicht aktiv",
    );
    // Escape bricht die Auswahl ab.
    app.doc.dispatchEvent(
      new app.win.KeyboardEvent("keydown", { key: "Escape" }),
    );
    await sleep(60);
    assert(
      app.win.Game.state.selectedAmount === null,
      "Escape bricht die Auswahl nicht ab",
    );
    assert(
      app.doc.querySelectorAll(".stone.selected").length === 0,
      "Escape räumt die Markierung nicht ab",
    );
    assert(takeBtn.disabled === true, "Escape sperrt „Nimm!“ nicht wieder");
    sameArray(app.win.Game.state.heaps, [4], "Cancel entfernt keine Rosine");
    assert(app.win.Game.state.lastMove === null, "Cancel erzeugt keinen Zug");
  }

  async function testWinAndRestart() {
    var app = await openConfiguredApp({
      minStones: 1,
      maxStones: 1,
      rule: "4er",
      opponent: "Mensch",
      start: "1",
    });
    click(app.doc, "#start-go-btn");
    pointerTap(app, 0, 0); // Schritt 1: letzte Rosine markieren
    await sleep(60);
    assert(
      app.win.Game.state.selectedAmount === 1,
      "letzte Rosine ist nicht markiert",
    );
    assert(
      app.win.Game.state.heaps[0] === 1,
      "Markierung entfernt die letzte Rosine sofort",
    );
    var takeBtn = app.doc.querySelector("#take-btn");
    assert(
      takeBtn.disabled === false,
      "„Nimm!“ ist auf der letzten Rosine nicht aktiv",
    );
    takeBtn.click(); // Schritt 2: bestätigen
    await waitUntil(
      function () {
        return app.win.Game.state.lock === false;
      },
      4000,
      "letzte Rosine",
    );
    var heap = app.doc.querySelector('.heap[data-heap-index="0"]');
    assert(
      heap.classList.contains("heap--empty"),
      "leerer Haufen wird nicht markiert",
    );
    assert(
      app.win.Game.state.heaps[0] === 0,
      "Spielzustand ist nach letzter Rosine nicht leer",
    );
    var overlay = app.doc.querySelector("#win-overlay");
    assert(overlay.hidden === false, "Sieg-Overlay erscheint nicht");
    assert(
      overlay
        .querySelector("#win-title")
        .textContent.indexOf("Lina hat gewonnen!") !== -1,
      "Sieg-Overlay nennt den Sieger nicht",
    );
    click(app.doc, "#new-game-btn");
    await waitUntil(
      function () {
        return app.win.Game.state.awaitingStart === true;
      },
      1500,
      "Noch-mal-Neustart",
    );
    assert(overlay.hidden === true, "Noch mal! blendet Sieg-Overlay nicht aus");
    sameArray(
      app.win.Game.state.heaps,
      [1],
      "Noch mal! übernimmt die deterministischen Optionen nicht",
    );
    assert(
      app.win.Game.state.lastMove === null,
      "Noch mal! setzt letzten Zug nicht zurück",
    );
  }

  var scenarioTests = [
    testInitialWaiting,
    testOptionsAndRuleHint,
    testHumanPointerTap,
    testAIStart,
    testInvalidTap,
    testSelectReplaceAndCancel,
    testWinAndRestart,
  ];

  function runWorker() {
    var index = parseInt(
      new URLSearchParams(window.location.search).get("scenario"),
      10,
    );
    if (!Number.isInteger(index) || !scenarioTests[index]) {
      return;
    }
    window.addEventListener("message", function (event) {
      if (event.data && event.data.type === "e2e-cleanup") {
        cleanupApp();
      }
    });
    window.addEventListener(
      "message",
      function (event) {
        if (!event.data || event.data.type !== "e2e-run") {
          return;
        }
        (async function () {
          var passed = true;
          var message = "";
          try {
            assert(
              window.Game && window.Nim && window.AI,
              "echte Spielskripte wurden nicht geladen",
            );
            await waitUntil(
              function () {
                return window.Game.state.heaps.length > 0;
              },
              2000,
              "Spielstart",
            );
            await scenarioTests[index]();
          } catch (error) {
            passed = false;
            message = error && error.message ? error.message : String(error);
          }
          window.parent.postMessage(
            {
              type: "e2e-result",
              scenario: index,
              passed: passed,
              message: message,
            },
            "*",
          );
        })();
      },
      { once: true },
    );
  }

  function runParent() {
    var resultRows = document.querySelector("#results");
    var overall = document.querySelector("#overall");
    var summary = document.querySelector("#summary");
    var results = [];
    var frameCounter = 0;

    function addResult(name, passed, message) {
      results.push({ name: name, passed: passed, message: message || "" });
      var li = document.createElement("li");
      li.className = passed ? "pass" : "fail";
      var status = document.createElement("span");
      status.className = "status";
      status.textContent = passed ? "PASS" : "FAIL";
      li.appendChild(status);
      li.appendChild(
        document.createTextNode(name + (message ? " — " + message : "")),
      );
      resultRows.appendChild(li);
    }

    function updateSummary(done) {
      var passed = results.filter(function (r) {
        return r.passed;
      }).length;
      summary.textContent =
        results
          .map(function (r) {
            return (
              (r.passed ? "PASS" : "FAIL") +
              "  " +
              r.name +
              (r.message ? " — " + r.message : "")
            );
          })
          .join("\n") +
        (done
          ? "\n\n" +
            passed +
            "/" +
            scenarioNames.length +
            " Szenarien bestanden."
          : "");
      overall.textContent = done
        ? (passed === scenarioNames.length ? "PASS" : "FAIL") +
          " — " +
          passed +
          "/" +
          scenarioNames.length +
          " Szenarien bestanden"
        : "Läuft … " + results.length + "/" + scenarioNames.length;
      overall.className = done
        ? passed === scenarioNames.length
          ? "pass"
          : "fail"
        : "running";
    }

    function runInFreshFrame(index) {
      return new Promise(function (resolve) {
        var frame = document.createElement("iframe");
        frame.className = "e2e-case-frame";
        frame.setAttribute("aria-hidden", "true");
        var settled = false;
        var timeout = setTimeout(function () {
          finish(false, "Timeout: echte index.html antwortet nicht");
        }, 8000);
        function finish(passed, message) {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timeout);
          frame.contentWindow.postMessage({ type: "e2e-cleanup" }, "*");
          setTimeout(function () {
            frame.remove();
            resolve({ passed: passed, message: message || "" });
          }, 20);
        }
        window.addEventListener("message", function onResult(event) {
          if (
            event.source !== frame.contentWindow ||
            !event.data ||
            event.data.type !== "e2e-result" ||
            event.data.scenario !== index
          ) {
            return;
          }
          window.removeEventListener("message", onResult);
          finish(event.data.passed, event.data.message);
        });
        frame.addEventListener(
          "load",
          function () {
            frame.contentWindow.postMessage(
              { type: "e2e-run", scenario: index },
              "*",
            );
          },
          { once: true },
        );
        frameCounter += 1;
        frame.src = new URL(
          "../index.html?e2e=1&scenario=" + index + "&run=" + frameCounter,
          location.href,
        ).href;
        document.body.appendChild(frame);
      });
    }

    async function runAll() {
      for (var i = 0; i < scenarioNames.length; i += 1) {
        var result = await runInFreshFrame(i);
        addResult(scenarioNames[i], result.passed, result.message);
        updateSummary(false);
      }
      updateSummary(true);
      window.__NIMM_E2E_RESULTS__ = results;
    }
    runAll();
  }

  var isWorker =
    window.top !== window &&
    new URLSearchParams(window.location.search).get("e2e") === "1";
  if (isWorker) {
    runWorker();
  } else if (window.top === window && document.querySelector("#results")) {
    runParent();
  }
})();
