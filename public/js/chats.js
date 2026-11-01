import {
  $, messagesEl, promptEl,
  state, current, makeId, persist
} from "./core.js";
import { renderMarkdown } from "./markdown.js";

// ---- Messages ----

export function addMessage(role, content, scroll = true) {
  const wrap = document.createElement("article");
  wrap.className = `message ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "You" : "◉";

  const body = document.createElement("div");
  body.className = "content";

  if (role === "assistant") {
    body.innerHTML = renderMarkdown(content);
  } else {
    body.textContent = content;
  }

  wrap.append(avatar, body);
  messagesEl.append(wrap);

  if (scroll) messagesEl.scrollTop = messagesEl.scrollHeight;

  return body;
}

export function renderMessages() {
  messagesEl.replaceChildren();

  const chat = current();

  if (!chat || !chat.messages.length) {
    const welcome = document.createElement("div");
    welcome.className = "welcome";

    welcome.innerHTML =
      '<div class="welcome-mark">◉</div><h1>What’s on your mind?</h1><p>Your private space to think, create, and explore.</p><div class="suggestions"><button type="button" data-prompt="Explain something difficult in simple terms.">Explain a topic</button><button type="button" data-prompt="Help me write a small JavaScript program.">Write some code</button><button type="button" data-prompt="Give me three creative project ideas.">Brainstorm ideas</button></div>';

    welcome.querySelectorAll("[data-prompt]").forEach(button => {
      button.addEventListener("click", () => {
        promptEl.value = button.dataset.prompt;
        // Go through the composer's submit handler (wired in main.js)
        // so this module doesn't need to import sendMessage.
        $("#composer").dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true })
        );
      });
    });

    messagesEl.append(welcome);
    return;
  }

  chat.messages.forEach(message => {
    addMessage(message.role, message.content, false);
  });

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ---- Chat management ----

export function newChat() {
  if (state.busy) return;

  const chat = { id: makeId(), title: "New chat", messages: [] };
  state.chats.unshift(chat);
  state.activeId = chat.id;

  persist();
  renderChatList();
  renderMessages();
  promptEl.focus();
}

// Chat list with rename and delete controls.
export function renderChatList() {
  const list = $("#chatList");
  list.replaceChildren();

  for (const chat of state.chats) {
    const item = document.createElement("div");
    item.className = `chat-item-wrapper${chat.id === state.activeId ? " active" : ""}`;

    const button = document.createElement("button");
    button.type = "button";
    button.className = `chat-item${chat.id === state.activeId ? " active" : ""}`;
    button.textContent = chat.title || "New chat";
    button.title = button.textContent;
    button.disabled = state.busy;

    button.addEventListener("click", () => {
      if (state.busy) return;

      state.activeId = chat.id;
      renderChatList();
      renderMessages();
      $("#sidebar").classList.remove("open");
    });

    const actions = document.createElement("div");
    actions.className = "chat-actions";

    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.textContent = "✎";
    renameBtn.title = "Rename chat";
    renameBtn.setAttribute("aria-label", "Rename chat");
    renameBtn.disabled = state.busy;

    renameBtn.addEventListener("click", (event) => {
      event.stopPropagation();

      const newTitle = window.prompt(
        "Enter a new chat name:",
        chat.title || "New chat"
      );

      if (newTitle === null) return;

      const title = newTitle.trim();
      if (!title) return;

      chat.title = title.slice(0, 60);
      persist();
      renderChatList();
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.textContent = "×";
    deleteBtn.title = "Delete chat";
    deleteBtn.setAttribute("aria-label", "Delete chat");
    deleteBtn.disabled = state.busy;

    deleteBtn.addEventListener("click", (event) => {
      event.stopPropagation();

      if (!window.confirm(
        `Delete "${chat.title || "New chat"}"? This cannot be undone.`
      )) {
        return;
      }

      state.chats = state.chats.filter(c => c.id !== chat.id);

      if (state.activeId === chat.id) {
        state.activeId = state.chats.length ? state.chats[0].id : null;
      }

      if (!state.activeId) {
        persist();
        newChat();
        return;
      }

      persist();
      renderChatList();
      renderMessages();
    });

    actions.append(renameBtn, deleteBtn);
    item.append(button, actions);
    list.append(item);
  }
}
