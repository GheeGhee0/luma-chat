import { $, THEME_STORAGE_KEY } from "./core.js";


export function applyTheme(theme) {
  const chosen = theme === "light" ? "light" : "dark";

  document.documentElement.dataset.theme = chosen;

  const lightNext = chosen === "dark";

  $("#themeToggle").textContent = lightNext ? "🌞" : "🌙";
  $("#themeToggle").setAttribute(
    "aria-label",
    lightNext ? "Switch to light mode" : "Switch to dark mode"
  );

  try {
    localStorage.setItem(THEME_STORAGE_KEY, chosen);
  } catch {}
}

export async function initTheme() {
  $("#themeToggle").addEventListener("click", () => {
    applyTheme(
      document.documentElement.dataset.theme === "dark" ? "light" : "dark"
    );
  });

  let defaultTheme = "dark";

  try {
    const response = await fetch("/api/config", {
      signal: AbortSignal.timeout(5000)
    });

    if (response.ok) {
      defaultTheme = (await response.json()).theme || defaultTheme;
    }
  } catch {}

  let savedTheme = null;

  try {
    savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  } catch {}

  applyTheme(savedTheme || defaultTheme);
}
