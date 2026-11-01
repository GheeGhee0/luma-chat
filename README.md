# Luma

A private, self-hosted chat UI for local models running on [Ollama](https://ollama.com). The browser talks to a small Express server, and the server talks to Ollama, so Ollama is never exposed to the browser directly.

```
Browser  →  Express (:8081)  →  Ollama (:11434)
         ←  streamed tokens   ←
```

## Features

- Streaming chat with live Markdown rendering (headings, lists, bold/italic, inline code, links)
- Fenced code blocks with a language label and a copy button
- Multiple conversations, saved in the browser (`localStorage`), with rename and delete
- Model picker populated from the models installed on Ollama
- **Stop generating**: the send button turns into a stop button while a response streams (or press `Esc`). Stopping also cancels the request to Ollama, and any partial answer is kept
- Auto-scroll that only follows the output when you're at the bottom, so you can scroll up and read while it generates
- Light and dark themes (default set in `config.json`, choice remembered per browser)
- Automatic model unloading after a period of inactivity, or when the last browser tab closes
- Server routes for pulling and deleting models (no UI for these yet; see [Managing models](#managing-models))

## Requirements

- Node.js 18 or newer
- An Ollama server reachable from the machine running Luma, with at least one model installed
- `"type": "module"` in `package.json` (the code uses ES modules)

## Quick start

```bash
npm install
node server.js
```

Then open `http://localhost:8081`.

Environment variables override the config file: `PORT`, `HOST`, and `MODEL_API_URL`.

## Project structure

```
luma/
├── server.js              # Entry point: middleware, routes, listen
├── config.json            # Settings (see below)
├── package.json
├── src/
│   ├── config.js          # Reads config.json, exports settings
│   ├── activity.js        # Loaded model, open tabs, idle unloading
│   ├── stream.js          # Streaming + cancel-on-disconnect helpers
│   └── routes/
│       ├── chat.js        # POST /api/chat
│       ├── models.js      # List, pull and delete models
│       └── session.js     # Session open / heartbeat / close
└── public/                # Served as static files
    ├── index.html
    ├── css/styles.css
    └── js/
        ├── main.js        # Entry point: event wiring and startup
        ├── core.js        # DOM helpers, constants, state, storage, status
        ├── markdown.js    # Markdown renderer and code-copy button
        ├── chats.js       # Message rendering and chat list
        ├── send.js        # Sending, streaming, stop, send button state
        ├── models.js      # Model list and picker
        ├── theme.js       # Light/dark theme
        └── session.js     # Session heartbeat
```

Adjust the `public/` layout to match your own file names. The only requirement is that the page loads the frontend with:

```html
<script type="module" src="js/main.js"></script>
```

ES modules must be served over HTTP, so opening `index.html` directly from disk (`file://`) won't work.

## Configuration

`config.json`:

```json
{
  "server": {
    "port": 8081,
    "host": "0.0.0.0",
    "modelApiUrl": "http://127.0.0.1:11434"
  },
  "model": {
    "keepAlive": "5m",
    "idleUnloadMs": 300000,
    "sessionTimeoutMs": 90000,
    "unloadOnLastTabClose": true
  },
  "chat": {
    "maxRequestBytes": "2mb",
    "maxMessages": 50
  },
  "ui": {
    "theme": "dark",
    "refreshModelsOnLoad": true
  }
}
```

| Key | Meaning |
|---|---|
| `server.port` / `server.host` | Where Luma listens. `0.0.0.0` makes it reachable from other devices on your network. |
| `server.modelApiUrl` | Base URL of the Ollama server. |
| `model.keepAlive` | Sent to Ollama with every chat request. Ollama keeps the model loaded this long after a response (e.g. `"5m"`, `"1h"`). |
| `model.idleUnloadMs` | Luma's own idle timer (milliseconds, minimum 10 000). When it expires with no activity, Luma tells Ollama to unload the model. |
| `model.sessionTimeoutMs` | How long a browser tab counts as open without a heartbeat (minimum 30 000). |
| `model.unloadOnLastTabClose` | Unload the model immediately when the last tab closes. |
| `chat.maxRequestBytes` | Maximum size of a request body. |
| `chat.maxMessages` | Maximum messages accepted per chat request (default 100 if omitted). |
| `ui.theme` | Default theme, `"dark"` or `"light"`, used until the user picks one. |
| `ui.refreshModelsOnLoad` | Present in the config but not currently read by the code. |

`keepAlive` and `idleUnloadMs` do the same job from two sides: Ollama enforces the first, Luma's server enforces the second. If you change one, change the other too, or the shorter one wins.

## API

All routes are served by the Express server under `/api`.

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/config` | Returns `{ "theme": "dark" }`. |
| `GET` | `/api/models` | Lists installed models (Ollama's `/api/tags`). |
| `POST` | `/api/models/pull` | Downloads a model. Body: `{ "model": "llama3.2:3b" }`. Streams progress as NDJSON. One pull at a time. |
| `DELETE` | `/api/models` | Deletes an installed model. Body: `{ "model": "llama3.2:3b" }`. |
| `POST` | `/api/chat` | Streams a chat reply as NDJSON. Body: `{ "model": "...", "messages": [{ "role": "user", "content": "..." }] }`. |
| `POST` | `/api/session/open` | Registers a browser tab. Body: `{ "id": "..." }`. |
| `POST` | `/api/session/heartbeat` | Keeps a tab registered (sent every 30 s). |
| `POST` | `/api/session/close` | Unregisters a tab. |

Chat requests are validated before being forwarded: the body must include a model and a non-empty message list, each message needs a role of `user`, `assistant` or `system` and text content, and the list can't exceed `chat.maxMessages`.

### Managing models

The pull and delete routes exist, but there is no interface for them yet. You can use them from the command line:

```bash
# Download a model (progress streams back)
curl -N -X POST http://localhost:8081/api/models/pull \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3.2:3b"}'

# Delete a model
curl -X DELETE http://localhost:8081/api/models \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3.2:3b"}'
```

Model names are validated, deleting only works on models that are actually installed, and a model can't be deleted while it is generating a response. The model picker only loads at page startup, so reload the page after pulling or deleting.

## How stopping works

1. Pressing the stop button (or `Esc`) aborts the browser's `fetch`.
2. The Express server notices the browser disconnected and aborts its request to Ollama.
3. Ollama closes the generation and frees the model for the next request.
4. The text generated so far is kept in the conversation.

The model itself stays loaded in memory until `keepAlive` or `idleUnloadMs` expires, which is normal. Stopping ends the generation, not the loaded model.

## Security notes

Luma is designed for use on a trusted home network.

- There is no authentication. Anyone who can reach port 8081 can chat and manage models.
- Ollama itself is also reachable at its own address, so a device on your network can bypass Luma entirely. To make Luma the only way in, bind Ollama to localhost (if it runs on the same machine) or restrict its port to the Luma server's IP.
- Conversations are stored in each browser's `localStorage`, not on the server.

## Known limitations

- Each request sends the whole conversation, and the server rejects requests with more than `chat.maxMessages` messages. A very long chat will hit that limit and show an error; start a new chat or raise the limit.
- The Markdown renderer is intentionally small. It does not support tables, blockquotes, images or nested lists.
- Chat history is per browser. It is not shared between devices.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "Service unavailable" in the sidebar | Luma can't reach Ollama. Check `server.modelApiUrl` and that Ollama is running and listening on the network. |
| "No models available" | No models are installed on the Ollama server. Pull one with the command above or `ollama pull`. |
| Blank page, errors about modules | The page is being opened from disk, or the script tag is missing `type="module"`. Serve it through the Express server. |
| Stop button works in the UI but the model keeps generating | Check that you're running the current `src/stream.js` and `src/routes/chat.js`. Watch CPU or GPU usage on the Ollama machine right after pressing stop. |
| Requests fail on long conversations | The chat has exceeded `chat.maxMessages`. |