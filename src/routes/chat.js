import express from "express";
import { MODEL_API_URL, KEEP_ALIVE, MAX_MESSAGES } from "../config.js";
import { touchActivity, beginRequest, endRequest } from "../activity.js";
import { abortOnDisconnect, pipeStream, setNdjsonHeaders } from "../stream.js";

const router = express.Router();

router.post("/chat", async (req, res) => {
    const { model, messages } = req.body ?? {};

    if (
        typeof model !== "string" ||
        !model.trim() ||
        !Array.isArray(messages) ||
        messages.length === 0
    ) {
        return res
            .status(400)
            .json({ error: "Send a model and a non-empty messages array." });
    }

    if (
        messages.length > MAX_MESSAGES ||
        messages.some(
            (m) =>
                !m ||
                !["user", "assistant", "system"].includes(m.role) ||
                typeof m.content !== "string"
        )
    ) {
        return res
            .status(400)
            .json({
                error: `Messages must have valid roles and text, with no more than ${MAX_MESSAGES} messages.`,
            });
    }

    // One controller for both the 10-minute cap and "browser pressed stop / closed the tab".
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10 * 60 * 1000);
    abortOnDisconnect(res, controller);

    beginRequest();
    try {
        touchActivity(model);
        const upstream = await fetch(`${MODEL_API_URL}/api/chat`, {
            method: "POST",
            body: JSON.stringify({
                model,
                messages,
                stream: true,
                keep_alive: KEEP_ALIVE,
            }),
            signal: controller.signal,
        });
        if (!upstream.ok || !upstream.body) {
            const detail = await upstream.text();
            return res
                .status(upstream.status || 502)
                .json({ error: detail || "Model request failed." });
        }
        setNdjsonHeaders(res);
        await pipeStream(upstream, res, () => touchActivity(model));
    } catch (error) {
        if (!res.headersSent)
            res.status(502).json({
                error: `Model request failed: ${error.message}`,
            });
        else if (!res.writableEnded) res.end();
    } finally {
        clearTimeout(timeout);
        endRequest();
        touchActivity(model);
    }
});

export default router;
