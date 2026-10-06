/* COCHI PWA - instalación como aplicación y modo independiente */
(function () {
  "use strict";

  function addMeta(name, content) {
    let el = document.querySelector('meta[name="' + name + '"]');
    if (!el) {
      el = document.createElement("meta");
      el.name = name;
      document.head.appendChild(el);
    }
    el.content = content;
  }

  function addLink(rel, href, extra) {
    let selector = 'link[rel="' + rel + '"]';
    if (extra && extra.sizes) selector += '[sizes="' + extra.sizes + '"]';
    let el = document.querySelector(selector);
    if (!el) {
      el = document.createElement("link");
      el.rel = rel;
      document.head.appendChild(el);
    }
    el.href = href;
    if (extra) {
      Object.keys(extra).forEach(key => {
        if (key !== "href") el.setAttribute(key, extra[key]);
      });
    }
  }

  function setupHead() {
    addLink("manifest", "/manifest.json");
    addLink("icon", "/icons/favicon-32.png", { type: "image/png", sizes: "32x32" });
    addLink("icon", "/icons/favicon-16.png", { type: "image/png", sizes: "16x16" });
    addLink("apple-touch-icon", "/icons/cochi-192.png", { sizes: "192x192" });
    addMeta("theme-color", "#151515");
    addMeta("mobile-web-app-capable", "yes");
    addMeta("apple-mobile-web-app-capable", "yes");
    addMeta("apple-mobile-web-app-status-bar-style", "black-translucent");
    addMeta("apple-mobile-web-app-title", "COCHI");
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/service-worker.js", { scope: "/" })
      .then(registration => {
        console.log("COCHI: aplicación PWA activa", registration.scope);
      })
      .catch(error => {
        console.error("COCHI: no se pudo activar la PWA", error);
      });
  }

  function init() {
    setupHead();
    registerServiceWorker();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
