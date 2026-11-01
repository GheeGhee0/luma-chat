import { SESSION_ID } from "./core.js";


async function startSession() {
  try {
    await fetch("/api/session/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: SESSION_ID })
    });
  } catch (error) {
    console.warn("Session registration failed:", error);
  }
}

export function initSession() {
  startSession();

  const heartbeatTimer = setInterval(() => {
    if (document.visibilityState !== "hidden") {
      fetch("/api/session/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: SESSION_ID })
      }).catch(() => {});
    }
  }, 30000);

  function closeSession() {
    clearInterval(heartbeatTimer);

    const payload = JSON.stringify({ id: SESSION_ID });

    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/session/close",
          new Blob([payload], { type: "application/json" })
        );
      } else {
        fetch("/api/session/close", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true
        }).catch(() => {});
      }
    } catch {}
  }

  window.addEventListener("pagehide", closeSession, { once: true });
}
