// Entry point: wires modules together and starts the app.
import { $, promptEl, state, current, readChats, persist } from "./core.js";
import { initCodeCopy } from "./markdown.js";
import { newChat, renderChatList, renderMessages } from "./chats.js";
import { sendMessage, stopGeneration } from "./send.js";
import { loadModels, initModelSelect } from "./models.js";
import { initTheme } from "./theme.js";
import { initSession } from "./session.js";

// Entry point: wires modules together and starts the app.

state.chats = readChats();

initCodeCopy();
initModelSelect();
initSession();

// Composer events.
$("#composer").addEventListener("submit", event => {
  event.preventDefault();

  // While a response is streaming, the send button acts as "stop".
  if (state.busy) {
    stopGeneration();
    return;
  }

  sendMessage();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && state.busy) stopGeneration();
});

promptEl.addEventListener("input", () => {
  promptEl.style.height = "auto";
  promptEl.style.height = `${Math.min(promptEl.scrollHeight, 180)}px`;
});

promptEl.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

$("#newChat").addEventListener("click", newChat);

$("#clearChat").addEventListener("click", () => {
  if (state.busy || !current()) return;

  current().messages = [];
  current().title = "New chat";

  persist();
  renderChatList();
  renderMessages();
});

$("#mobileMenu").addEventListener("click", () => {
  $("#sidebar").classList.toggle("open");
});

// Initialize theme (async; doesn't block the rest).
initTheme();

// Initialize chats.
if (state.chats.length) {
  state.activeId = state.chats[0].id;
  renderChatList();
  renderMessages();
} else {
  newChat();
}

loadModels();