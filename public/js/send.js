import {
  $, messagesEl, promptEl, sendBtn,
  state, current, persist, setStatus
} from "./core.js";
import { renderMarkdown } from "./markdown.js";
import { addMessage, newChat, renderChatList } from "./chats.js";

// ---- Busy state ----

export function setBusy(value) {
  state.busy = value;
  // The send button doubles as a stop button while a response is streaming.
  sendBtn.textContent = value ? "❌" : "⬆️";
  sendBtn.title = value ? "Stop generating" : "Send";
  sendBtn.setAttribute("aria-label", value ? "Stop generating" : "Send message");
  sendBtn.classList.toggle("stop", value);
  $("#newChat").disabled = value;
  renderChatList();
}

export function stopGeneration() {
  state.activeController?.abort();
}

// ---- Sending ----

export async function sendMessage() {
  const text = promptEl.value.trim();
  const model = $("#modelSelect").value;

  if (!text || state.busy) return;

  if (!model) {
    setStatus("Select an available model", false);
    return;
  }

  if (!current()) newChat();

  const chat = current();

  chat.messages.push({ role: "user", content: text });

  if (chat.messages.length === 1) {
    chat.title = text.slice(0, 38) + (text.length > 38 ? "…" : "");
  }

  promptEl.value = "";
  promptEl.style.height = "auto";

  persist();
  renderChatList();
  addMessage("user", text);

  const assistantBody = addMessage("assistant", "");
  assistantBody.innerHTML = `
    <div class="typing-indicator" aria-label="Luma is thinking">
      <span></span>
      <span></span>
      <span></span>
    </div>
  `;

  setBusy(true);
  state.activeController = new AbortController();

  let answer = "";

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: chat.messages
      }),
      signal: state.activeController.signal
    });

    if (!response.ok) {
      let detail = `Model request failed (HTTP ${response.status}).`;

      try {
        detail = (await response.json()).error || detail;
      } catch {}

      throw new Error(detail);
    }

    if (!response.body) {
      throw new Error("This browser does not support response streaming.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";

    const consumeLine = line => {
      if (!line.trim()) return;

      const packet = JSON.parse(line);

      if (packet.error) throw new Error(packet.error);

      if (packet.message?.content) {
        answer += packet.message.content;

        // Only follow the output if the user is already at (or near) the
        // bottom, so they can scroll up and read while it's generating.
        const nearBottom =
          messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 80;

        assistantBody.innerHTML = renderMarkdown(answer);

        if (nearBottom) messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    };

    try {
      while (true) {
        const { value, done } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          consumeLine(line);
        }
      }

      buffer += decoder.decode();

      if (buffer.trim()) {
        consumeLine(buffer);
      }
    } finally {
      reader.releaseLock();
    }

    if (!answer.trim()) {
      assistantBody.textContent =
        "The model returned an empty response. Try again.";
    }

    chat.messages.push({ role: "assistant", content: answer });
    persist();
  } catch (error) {
    if (error.name === "AbortError") {
      if (answer.trim()) {
        // Keep and save whatever was generated before the stop.
        assistantBody.innerHTML = renderMarkdown(answer);
        chat.messages.push({ role: "assistant", content: answer });
        persist();
      } else {
        assistantBody.textContent = "Response cancelled.";
      }
    } else {
      assistantBody.classList.add("error");
      assistantBody.textContent =
        `Error: ${error.message}\n\nCheck that the model service is running and the selected model is available.`;

      console.error("Luma chat:", error);
    }
  } finally {
    state.activeController = null;
    setBusy(false);
    promptEl.focus();
  }
}