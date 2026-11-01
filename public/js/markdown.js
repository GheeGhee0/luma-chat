import { messagesEl } from "./core.js";

export function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

export function renderMarkdown(source) {
  // Extract fenced code blocks before escaping HTML.
  const blocks = [];

  let text = String(source ?? "").replace(
    /```([\w+-]*)\n?([\s\S]*?)```/g,
    (_match, language, code) => {
      const token = `@@CODEBLOCK${blocks.length}@@`;

      const languageName = language || "Code";

      blocks.push(`
        <div class="code-block">
          <div class="code-header">
            <span class="code-language">${escapeHTML(languageName)}</span>
            <button type="button" class="copy-code-button">
              Copy
            </button>
          </div>
          <pre><code${language ? ` class="language-${escapeHTML(language)}"` : ""}>${escapeHTML(code.replace(/\n$/, ""))}</code></pre>
        </div>
      `);

      return `\n${token}\n`;
    }
  );

  // Escape source HTML first.
  text = escapeHTML(text);

  // Preserve inline code.
  const inlineCodes = [];

  text = text.replace(/`([^`\n]+)`/g, (_match, code) => {
    const token = `@@INLINECODE${inlineCodes.length}@@`;
    inlineCodes.push(`<code>${code}</code>`);
    return token;
  });

  // Preserve links so their labels and URLs are not affected by formatting.
  const links = [];

  text = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_match, label, url) => {
      let safeUrl;

      try {
        safeUrl = new URL(url);

        if (!["http:", "https:"].includes(safeUrl.protocol)) {
          return label;
        }
      } catch {
        return label;
      }

      const token = `@@LINK${links.length}@@`;

      links.push(
        `<a href="${escapeHTML(safeUrl.href)}" target="_blank" rel="noopener noreferrer">${label}</a>`
      );

      return token;
    }
  );

  // Bold, italic, and bold italic.
  text = text
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/___(.+?)___/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=$|[\s).,!?:;])/g, "$1<em>$2</em>")
    .replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s).,!?:;])/g, "$1<em>$2</em>");

  // Restore inline code.
  text = text.replace(
    /@@INLINECODE(\d+)@@/g,
    (_match, index) => inlineCodes[Number(index)] || ""
  );

  const rendered = text.split(/\n{2,}/).map(part => {
    const trimmed = part.trim();

    if (!trimmed) return "";

    const blockMatch = trimmed.match(/^@@CODEBLOCK(\d+)@@$/);
    if (blockMatch) return blocks[Number(blockMatch[1])] || "";

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);

    if (heading) {
      const level = heading[1].length;
      return `<h${level}>${heading[2]}</h${level}>`;
    }

    if (/^(?:[-*])\s+/m.test(trimmed)) {
      const items = trimmed
        .split("\n")
        .map(line => line.match(/^\s*[-*]\s+(.+)$/))
        .filter(Boolean);

      if (items.length) {
        return `<ul>${items.map(item => `<li>${item[1]}</li>`).join("")}</ul>`;
      }
    }

    if (/^\d+\.\s+/m.test(trimmed)) {
      const items = trimmed
        .split("\n")
        .map(line => line.match(/^\s*\d+\.\s+(.+)$/))
        .filter(Boolean);

      if (items.length) {
        return `<ol>${items.map(item => `<li>${item[1]}</li>`).join("")}</ol>`;
      }
    }

    return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
  }).join("");

  // Restore links and code blocks.
  return rendered
    .replace(/@@LINK(\d+)@@/g, (_match, index) => links[Number(index)] || "")
    .replace(/@@CODEBLOCK(\d+)@@/g, (_match, index) => blocks[Number(index)] || "");
}

// ---- Code block copy button ----

async function copyCode(button) {
  const code = button.closest(".code-block")?.querySelector("pre code");

  if (!code) return;

  const originalText = button.textContent;

  try {
    try {
      await navigator.clipboard.writeText(code.textContent);
    } catch {
      // Fallback for browsers without Clipboard API access.
      const textarea = document.createElement("textarea");
      textarea.value = code.textContent;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";

      document.body.append(textarea);
      textarea.select();

      const success = document.execCommand("copy");
      textarea.remove();

      if (!success) throw new Error("Copy failed");
    }

    button.textContent = "Copied!";
    button.classList.add("copied");
  } catch (error) {
    button.textContent = "Failed";
    console.error("Luma copy:", error);
  }

  setTimeout(() => {
    if (!button.isConnected) return;

    button.textContent = originalText;
    button.classList.remove("copied");
  }, 1500);
}

export function initCodeCopy() {
  messagesEl.addEventListener("click", event => {
    const button = event.target.closest(".copy-code-button");

    if (button) copyCode(button);
  });
}
