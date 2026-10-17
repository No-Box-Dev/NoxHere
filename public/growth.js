/* NoxHere Growth browser client: first-party, anonymous acquisition tracking. */
(function () {
  "use strict";

  var script = document.currentScript;
  var config = script && script.dataset ? script.dataset : {};
  var key = config.key || "";
  var endpoint = config.endpoint || "https://app.noxhere.com/api/v1/growth/events";
  var environment = config.environment || "production";
  var autoPageviews = config.autoPageviews !== "false";
  var autoSpa = config.autoSpa !== "false";
  var consentRequired = config.consent === "required";
  var visitorStorageKey = "nox_growth_visitor";
  var sessionStorageKey = "nox_growth_session";
  var firstTouchStorageKey = "nox_growth_first_touch";
  var consentStorageKey = "nox_growth_consent";
  var sessionLifetimeMs = 30 * 60 * 1000;
  var started = false;
  var lastPage = "";

  function randomId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return prefix + window.crypto.randomUUID();
    var bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    var hex = Array.prototype.map.call(bytes, function (value) {
      return value.toString(16).padStart(2, "0");
    });
    return prefix + hex.slice(0, 4).join("") + "-" + hex.slice(4, 6).join("") + "-"
      + hex.slice(6, 8).join("") + "-" + hex.slice(8, 10).join("") + "-" + hex.slice(10).join("");
  }

  function readStorage(name) {
    try { return window.localStorage.getItem(name); } catch (_) { return null; }
  }

  function writeStorage(name, value) {
    try { window.localStorage.setItem(name, value); } catch (_) { /* Storage can be unavailable. */ }
  }

  function visitorId() {
    var existing = readStorage(visitorStorageKey);
    if (existing) return existing;
    var created = randomId("anon_");
    writeStorage(visitorStorageKey, created);
    return created;
  }

  function sessionId() {
    var now = Date.now();
    var stored = readStorage(sessionStorageKey);
    if (stored) {
      try {
        var parsed = JSON.parse(stored);
        if (typeof parsed.id === "string" && now - Number(parsed.seenAt) < sessionLifetimeMs) {
          writeStorage(sessionStorageKey, JSON.stringify({ id: parsed.id, seenAt: now }));
          return parsed.id;
        }
      } catch (_) { /* Replace malformed local state. */ }
    }
    var created = randomId("session_");
    writeStorage(sessionStorageKey, JSON.stringify({ id: created, seenAt: now }));
    return created;
  }

  function touch() {
    var params = new URLSearchParams(window.location.search);
    var referrerHost = "";
    if (document.referrer) {
      try {
        var referrer = new URL(document.referrer);
        if (referrer.hostname !== window.location.hostname) referrerHost = referrer.hostname;
      } catch (_) { /* Ignore invalid browser referrers. */ }
    }
    return {
      utm_source: params.get("utm_source") || "",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || "",
      utm_content: params.get("utm_content") || "",
      utm_term: params.get("utm_term") || "",
      referrer_host: referrerHost,
      landing_path: window.location.pathname.slice(0, 500),
    };
  }

  function hasAcquisition(value) {
    return Boolean(value.utm_source || value.utm_medium || value.utm_campaign || value.referrer_host);
  }

  function attribution() {
    var current = touch();
    var stored = readStorage(firstTouchStorageKey);
    var parsedStored = null;
    if (stored) {
      try { parsedStored = JSON.parse(stored); } catch (_) { /* Replace malformed local state. */ }
    }
    if (!parsedStored || (!hasAcquisition(parsedStored) && hasAcquisition(current))) {
      writeStorage(firstTouchStorageKey, JSON.stringify(current));
      parsedStored = current;
    }
    if (hasAcquisition(current)) return current;
    return parsedStored || current;
  }

  function allowed() {
    return !consentRequired || readStorage(consentStorageKey) === "granted";
  }

  function compactAttributes(extra) {
    var values = Object.assign({
      anonymous_id: visitorId(),
      session_id: sessionId(),
    }, attribution(), extra || {});
    return Object.fromEntries(Object.entries(values).filter(function (entry) {
      return entry[1] !== "" && entry[1] !== null && entry[1] !== undefined;
    }));
  }

  function track(name, options) {
    if (!key || !allowed()) return Promise.resolve({ accepted: false, skipped: true });
    var payload = {
      version: 1,
      type: "activity.tracked",
      eventId: randomId(""),
      name: name,
      value: options && typeof options.value === "number" ? options.value : 1,
      environment: environment,
      occurredAt: new Date().toISOString(),
      attributes: compactAttributes(options && options.attributes),
    };
    return window.fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Nox-Ingest-Key": key },
      body: JSON.stringify(payload),
      keepalive: true,
      credentials: "omit",
    }).then(function (response) {
      if (!response.ok) throw new Error("Growth event was rejected with HTTP " + response.status);
      return response.json();
    }).catch(function () { return { accepted: false }; });
  }

  function page() {
    var path = window.location.pathname + window.location.search;
    if (path === lastPage) return;
    lastPage = path;
    void track("website.page_visited");
  }

  function start() {
    if (started || !allowed()) return;
    started = true;
    if (autoPageviews) page();
    document.addEventListener("click", function (event) {
      var target = event.target instanceof Element ? event.target.closest("[data-nox-growth]") : null;
      var name = target && target.getAttribute("data-nox-growth");
      if (name) void track(name);
    }, { capture: true });
    if (autoPageviews && autoSpa && window.history) {
      ["pushState", "replaceState"].forEach(function (method) {
        var original = window.history[method];
        window.history[method] = function () {
          var result = original.apply(this, arguments);
          window.setTimeout(page, 0);
          return result;
        };
      });
      window.addEventListener("popstate", page);
    }
  }

  window.NoxHereGrowth = {
    track: track,
    page: page,
    context: function () { return compactAttributes(); },
    consent: function (value) {
      writeStorage(consentStorageKey, value === "granted" ? "granted" : "denied");
      if (value === "granted") start();
    },
  };
  start();
})();
