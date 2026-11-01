import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Project root (one level above src/), where config.json and public/ live.
export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let config;
try {
  config = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "config.json"), "utf8"));
} catch (error) {
  console.error(`Could not read config.json: ${error.message}`);
  process.exit(1);
}

export const PORT = Number(process.env.PORT || config.server?.port || 8081);
export const HOST = process.env.HOST || config.server?.host || "0.0.0.0";
export const MODEL_API_URL = (process.env.MODEL_API_URL || config.server?.modelApiUrl || "http://127.0.0.1:11434").replace(/\/$/, "");

export const KEEP_ALIVE = config.model?.keepAlive ?? "5m";
export const IDLE_UNLOAD_MS = Math.max(10000, Number(config.model?.idleUnloadMs ?? 300000));
export const SESSION_TIMEOUT_MS = Math.max(30000, Number(config.model?.sessionTimeoutMs ?? 90000));
export const UNLOAD_ON_LAST_TAB_CLOSE = config.model?.unloadOnLastTabClose !== false;

export const MAX_MESSAGES = Math.max(1, Number(config.chat?.maxMessages ?? 100));
export const MAX_REQUEST_BYTES = config.chat?.maxRequestBytes || "2mb";

export const THEME = config.ui?.theme || "dark";

// Letters, digits, "_", ".", "-", ":" and "/" (e.g. "llama3:8b", "hf.co/org/model:Q4_K_M").
export const MODEL_NAME_RE = /^\w[\w.\-:/]{0,199}$/;