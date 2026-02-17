# Apollo Chat

Local-first AI chat UI + API — built for **Ollama** (today) and more providers later.

- **Streaming chat** with persistent history
- **Vision + uploads**
- **Tools** (web search, fetch) + tool output
- **Voice-to-text**

> The UI is evolving, but the core workflow is already solid.

## Features (at a glance)

### Shipping

- [x] Chat history (SQLite persistence)
- [x] List chats + messages
- [x] Streaming responses + loading states
- [x] Ollama integration + model list
- [x] Vision support + file uploads
- [x] Tools: web search, fetch, tool output
- [x] Thinking mode
- [x] Voice-to-text

### Next up

- [ ] Conversation title + summary
- [ ] Better message actions (copy/edit/retry/metadata)
- [ ] Export / delete / archive chats + folders
- [ ] Settings page (providers + options)
- [ ] UX hardening (errors, context mgmt, abort on close)
- [ ] More providers (LM Studio, etc.)

## Run locally (development)

### Prerequisites

- **Node.js**: `^20.19.0` or `>=22.12.0`
- **pnpm**: `>=8`
- **Ollama**: installed + running ([ollama.ai](https://ollama.ai))

### Install + start

```bash
pnpm install
pnpm dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`

### Run services individually

```bash
pnpm dev:frontend
pnpm dev:backend
```

### Ollama endpoint

By default the backend expects Ollama at `http://localhost:11434`.

## Docker (compose)

Apollo Chat can run in a production-ish setup via Compose:

- **Frontend**: nginx (proxies `/api/*` → backend)
- **Backend**: Express API (runs DB migrations on container start)
- **Persistence**: named volumes for SQLite + uploads

### Prerequisites

- **Docker** + **Docker Compose**
- **External Ollama endpoint** (if using Ollama provider)
  - Set `OLLAMA_HOST` to a reachable URL from inside Docker (for example `https://ollama.example.com`):

```bash
export OLLAMA_HOST=https://ollama.example.com
```

### Run (build + start)

```bash
docker compose up --build
```

Open:

- Frontend: `http://localhost:8080`
- API (via nginx): `http://localhost:8080/api/*`

### How Ollama works in Docker

The backend uses `OLLAMA_HOST` from your environment. Compose does not map to a host-local Ollama anymore, so the endpoint must be externally reachable by the backend container.

### Database migrations in Docker

Backend startup applies committed Drizzle migrations from `apps/backend/drizzle` before the API process starts.

- Generate a new migration after schema changes:

```bash
pnpm --filter @apollo-chat/backend db:generate
```

- Apply migrations locally:

```bash
DB_FILE_NAME=file:./apps/backend/data/history.db pnpm --filter @apollo-chat/backend db:migrate
```

- In Docker, migrations are applied automatically on backend container start.

### Data persistence

Compose creates named volumes:

- `apollo-chat_db-data` (SQLite database at `/app/data/history.db`)
- `apollo-chat_uploads-data` (uploaded files at `/app/apps/backend/uploads`)

To stop:

```bash
docker compose down
```

To also remove volumes (deletes DB + uploads):

```bash
docker compose down -v
```

### Production env checklist

At minimum, configure:

- `OLLAMA_HOST` (external endpoint, if Ollama provider is enabled)
- `DB_FILE_NAME` (Compose defaults to `file:/app/data/history.db`)
- Clerk/auth variables required by your environment
- S3 variables (`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, optional region/path-style flags)

### SQLite backup and rollback

SQLite data is stored in the named Docker volume `apollo-chat_db-data`. Before risky deploys:

1. Stop writes to the app.
2. Snapshot/backup the `history.db` file from the volume.
3. Deploy and run health checks.
4. If rollback is needed, restore the volume backup and restart containers.

## Handy scripts

- **dev**: `pnpm dev` (both apps)
- **dev (one app)**: `pnpm dev:frontend` / `pnpm dev:backend`
- **build**: `pnpm build`
- **test**: `pnpm test`
- **lint/format**: `pnpm lint` / `pnpm format`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License

Copyright (c) 2026 Apollo Chat

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
