import express from "express";
import { MODEL_API_URL, MODEL_NAME_RE } from "../config.js";
import { isModelBusy, forgetModel } from "../activity.js";
import { abortOnDisconnect, pipeStream, setNdjsonHeaders } from "../stream.js";

const router = express.Router();
let pullInProgress = false;

// List installed models.
router.get("/models", async (_req, res) => {
  try {
    const r = await fetch(`${MODEL_API_URL}/api/tags`, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) return res.status(r.status).json({ error: "The model service couldn't list models." });
    res.json(await r.json());
  } catch (error) {
    res.status(502).json({ error: `Can't reach model service at ${MODEL_API_URL}: ${error.message}` });
  }
});

// Pull (download) a model. Streams Ollama's progress lines back as NDJSON:
// {"status":"pulling ...","total":123,"completed":45} ... {"status":"success"}
router.post("/models/pull", async (req, res) => {
  const model = typeof req.body?.model === "string" ? req.body.model.trim() : "";
  if (!MODEL_NAME_RE.test(model)) {
    return res.status(400).json({ error: "Send a valid model name, e.g. llama3.2:3b." });
  }
  if (pullInProgress) {
    return res.status(409).json({ error: "Another model is already being downloaded." });
  }

  pullInProgress = true;
  const controller = new AbortController();
  abortOnDisconnect(res, controller);

  try {
    const upstream = await fetch(`${MODEL_API_URL}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, stream: true }),
      signal: controller.signal
    });
    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text();
      return res.status(upstream.status || 502).json({ error: detail || "Model download failed." });
    }
    setNdjsonHeaders(res);
    await pipeStream(upstream, res);
  } catch (error) {
    if (!res.headersSent) res.status(502).json({ error: `Model download failed: ${error.message}` });
    else if (!res.writableEnded) res.end();
  } finally {
    pullInProgress = false;
  }
});

// Delete an installed model. Body: { "model": "name:tag" }
// (Sent in the body rather than the URL because names can contain "/").
router.delete("/models", async (req, res) => {
  const model = typeof req.body?.model === "string" ? req.body.model.trim() : "";
  if (!MODEL_NAME_RE.test(model)) {
    return res.status(400).json({ error: "Send a valid model name." });
  }
  if (isModelBusy(model)) {
    return res.status(409).json({ error: "That model is generating a response right now." });
  }

  try {
    // Only delete models that are actually installed.
    const tags = await fetch(`${MODEL_API_URL}/api/tags`, { signal: AbortSignal.timeout(15000) });
    if (!tags.ok) return res.status(502).json({ error: "The model service couldn't list models." });
    const { models } = await tags.json();
    const installed = Array.isArray(models) && models.some(m => m?.name === model || m?.model === model);
    if (!installed) return res.status(404).json({ error: `Model "${model}" is not installed.` });

    const r = await fetch(`${MODEL_API_URL}/api/delete`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
      signal: AbortSignal.timeout(30000)
    });
    if (!r.ok) {
      const detail = await r.text();
      return res.status(r.status).json({ error: detail || "Could not delete the model." });
    }
    forgetModel(model);
    res.json({ ok: true });
  } catch (error) {
    res.status(502).json({ error: `Can't reach model service at ${MODEL_API_URL}: ${error.message}` });
  }
});

export default router;