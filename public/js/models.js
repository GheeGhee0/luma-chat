import { $, MODEL_STORAGE_KEY, setStatus } from "./core.js";


export function updateModelLabel() {
  $("#topModelName").textContent =
    $("#modelSelect").value || "No model selected";
}

export async function loadModels() {
  const select = $("#modelSelect");
  select.replaceChildren(new Option("Loading models…", ""));

  try {
    const response = await fetch("/api/models", {
      signal: AbortSignal.timeout(15000)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not load models.");
    }

    const models = Array.isArray(data.models) ? data.models : [];
    select.replaceChildren();

    for (const model of models) {
      if (!model?.name) continue;
      select.add(new Option(model.name, model.name));
    }

    if (!select.options.length) {
      throw new Error("No models installed on the model server.");
    }

    const saved = localStorage.getItem(MODEL_STORAGE_KEY);

    if (saved && [...select.options].some(option => option.value === saved)) {
      select.value = saved;
    }

    updateModelLabel();
    setStatus("Service connected", true);
  } catch (error) {
    select.replaceChildren(new Option("No models available", ""));
    updateModelLabel();
    setStatus("Service unavailable", false);
    console.error("Luma model list:", error);
  }
}

export function initModelSelect() {
  $("#modelSelect").addEventListener("change", () => {
    try {
      localStorage.setItem(MODEL_STORAGE_KEY, $("#modelSelect").value);
    } catch {}

    updateModelLabel();
  });
}
