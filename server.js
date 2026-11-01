import express from "express";
import path from "node:path";
import {
  ROOT_DIR, PORT, HOST, MODEL_API_URL,
  MAX_REQUEST_BYTES, IDLE_UNLOAD_MS, THEME
} from "./src/config.js";
import modelRoutes from "./src/routes/models.js";
import chatRoutes from "./src/routes/chat.js";
import sessionRoutes from "./src/routes/session.js";

const app = express();

app.use(express.json({ limit: MAX_REQUEST_BYTES }));
app.use(express.static(path.join(ROOT_DIR, "public")));

app.get("/api/config", (_req, res) => {
  res.json({ theme: THEME });
});

app.use("/api", modelRoutes, chatRoutes, sessionRoutes);

app.listen(PORT, HOST, () => {
  console.log(`Luma running at http://localhost:${PORT}`);
  console.log(`Model API endpoint: ${MODEL_API_URL}`);
  console.log(`Model unloads after ${Math.round(IDLE_UNLOAD_MS / 60000)} minute(s) of inactivity.`);
});