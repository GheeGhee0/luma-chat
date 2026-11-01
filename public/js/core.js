// Core: DOM helpers, constants, shared state, storage and status.

// ---- DOM ----
// Shared DOM helpers and frequently used elements.
export const $ = (selector) => document.querySelector(selector);

export const messagesEl = $("#messages");
export const promptEl = $("#prompt");
export const sendBtn = $("#sendBtn");

// ---- Config ----
// Constants and tiny utilities with no dependencies.
export const MODEL_STORAGE_KEY = "luma-model";
export const THEME_STORAGE_KEY = "luma-theme";
export const CHAT_STORAGE_KEY = "luma-conversations";

export function makeId() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}

export const SESSION_ID = makeId();

// ---- State ----
// Shared mutable app state. Wrapped in an object because ES module
// bindings can't be reassigned from other modules.
export const state = {
  chats: [],
  activeId: null,
  busy: false,
  activeController: null
};

export function current() {
  return state.chats.find(c => c.id === state.activeId);
}

// ---- Status ----

export function setStatus(message, online = false) {
  $("#connection").textContent = message;
  $(".status-dot").classList.toggle("online", online);
}

// ---- Storage ----

export function readChats() {
  try {
    const value = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || "[]");
    return Array.isArray(value)
      ? value.filter(c => c && typeof c.id === "string" && Array.isArray(c.messages))
      : [];
  } catch {
    return [];
  }
}

export function persist() {
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(state.chats));
  } catch {
    setStatus("Chat storage is full", false);
  }
}
