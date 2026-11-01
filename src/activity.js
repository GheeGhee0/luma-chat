// Tracks which model is loaded, open browser tabs (sessions) and in-flight
// requests, and unloads the model from memory when it has been idle.
import {
  MODEL_API_URL,
  IDLE_UNLOAD_MS,
  SESSION_TIMEOUT_MS,
  UNLOAD_ON_LAST_TAB_CLOSE
} from "./config.js";

let lastActivity = 0;
let loadedModel = null;
let unloadTimer = null;
let unloadInProgress = false;
let activeRequests = 0;
const sessions = new Map();

function pruneSessions() {
  const now = Date.now();
  for (const [id, seen] of sessions) if (now - seen > SESSION_TIMEOUT_MS) sessions.delete(id);
}

function scheduleUnload() {
  clearTimeout(unloadTimer);
  unloadTimer = setTimeout(() => unloadIfIdle("idle timeout"), IDLE_UNLOAD_MS);
  unloadTimer.unref?.();
}

async function unloadIfIdle(reason) {
  if (unloadInProgress || !loadedModel || !lastActivity) return;
  if (activeRequests > 0) return scheduleUnload();
  pruneSessions();
  if (Date.now() - lastActivity < IDLE_UNLOAD_MS) return scheduleUnload();
  unloadInProgress = true;
  const model = loadedModel;
  try {
    const response = await fetch(`${MODEL_API_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: "", stream: false, keep_alive: 0 }),
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`Unload returned HTTP ${response.status}`);
    if (loadedModel === model) loadedModel = null;
    console.log(`Unloaded ${model} (${reason}).`);
  } catch (error) {
    console.warn(`Could not unload ${model}: ${error.message}`);
    scheduleUnload();
  } finally {
    unloadInProgress = false;
  }
}

// ---- Activity ----

export function touchActivity(model = null) {
  lastActivity = Date.now();
  if (model) loadedModel = model;
  scheduleUnload();
}

export function beginRequest() {
  activeRequests += 1;
}

export function endRequest() {
  activeRequests = Math.max(0, activeRequests - 1);
}

// True while the given model is the loaded one and a response is being generated.
export function isModelBusy(model) {
  return activeRequests > 0 && loadedModel === model;
}

// Call after a model is deleted so we don't try to unload it later.
export function forgetModel(model) {
  if (loadedModel === model) loadedModel = null;
}

// ---- Sessions (open browser tabs) ----

export function touchSession(id) {
  pruneSessions();
  sessions.set(id, Date.now());
}

export function closeSession(id) {
  if (id) sessions.delete(id);
  pruneSessions();
  if (UNLOAD_ON_LAST_TAB_CLOSE && sessions.size === 0 && loadedModel) {
    lastActivity = Date.now() - IDLE_UNLOAD_MS;
    void unloadIfIdle("last tab closed");
  }
}