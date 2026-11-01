import express from "express";
import { touchSession, closeSession } from "../activity.js";

const router = express.Router();

const sessionId = req => String(req.body?.id || "").slice(0, 100);

// Opening a session and sending a heartbeat do the same thing.
router.post(["/session/open", "/session/heartbeat"], (req, res) => {
  const id = sessionId(req);
  if (!id) return res.status(400).json({ error: "A session ID is required." });
  touchSession(id);
  res.json({ ok: true });
});

router.post("/session/close", (req, res) => {
  closeSession(sessionId(req));
  res.json({ ok: true });
});

export default router;