// Helpers for streaming Ollama's NDJSON responses through to the browser.

export function setNdjsonHeaders(res) {
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
}

// Abort the upstream (Ollama) request if the browser goes away before we finish.
// Aborting closes the connection to Ollama, which is what makes it stop generating.
export function abortOnDisconnect(res, controller) {
  res.on("close", () => {
    if (!res.writableFinished) controller.abort();
  });
}

// Copy an upstream NDJSON stream to the browser.
export async function pipeStream(upstream, res, onChunk) {
  const reader = upstream.body.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done || res.destroyed) break;
      onChunk?.();
      if (!res.write(value)) {
        // Wait for the browser to catch up, but don't hang forever if it disconnects.
        await new Promise(resolve => {
          const finish = () => {
            res.off("drain", finish);
            res.off("close", finish);
            resolve();
          };
          res.once("drain", finish);
          res.once("close", finish);
        });
      }
    }
  } finally {
    // releaseLock() alone leaves the upstream connection open; cancel() closes it.
    reader.cancel().catch(() => {});
    if (!res.writableEnded) res.end();
  }
}