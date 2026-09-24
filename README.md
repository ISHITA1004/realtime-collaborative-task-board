# Real-Time Collaborative Task Board

A Trello-style board where multiple people can work on the same set of tasks at once — create boards, invite teammates, drag tasks across Todo / In Progress / Done, and see every change from other people show up live, no refresh needed.

## Stack

- **Client**: Next.js (App Router) + React + TypeScript, Tailwind for styling, `@dnd-kit` for drag-and-drop, `socket.io-client` for realtime.
- **Server**: Node + Express + TypeScript, Mongoose (MongoDB), `socket.io` for realtime, JWT for auth.
- **Tests**: Jest + Supertest against `mongodb-memory-server` (no external DB needed to run the suite).

The client and server are two independent projects (`client/`, `server/`) with no shared package between them — they're meant to deploy separately (client to Vercel, server to Render/Railway/etc.), so keeping them decoupled avoids monorepo tooling that neither deploy target needs. Each side keeps its own small `types.ts`.

## Running it locally

### Option A — Docker Compose

```bash
docker compose up --build
```

This starts MongoDB, the server on `:4000`, and the client on `:3000`. Open `http://localhost:3000`.

### Option B — manually

```bash
# server
cd server
cp .env.example .env   # edit MONGODB_URI if you're not running Mongo locally
npm install
npm run dev

# client, in a second terminal
cd client
cp .env.example .env.local
npm install
npm run dev
```

You need a MongoDB instance reachable at `MONGODB_URI` (local `mongod`, Docker, or Atlas).

### Running the tests

```bash
cd server
npm test
```

This spins up an in-memory MongoDB per test run, so it doesn't touch your real database.

## Deploying

The client and server are built to deploy independently:

- **Server → Render/Railway/Fly/etc.**: point it at the `server/` folder, set `MONGODB_URI` (e.g. Atlas), `JWT_SECRET`, `CLIENT_URL` (your deployed frontend origin, used for CORS and Socket.IO CORS), `PORT`. `server/Dockerfile` works if the platform wants a container, or run `npm run build && npm start` directly.
- **Client → Vercel**: point it at the `client/` folder, set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL` to the deployed server's URL.

Auth uses a JWT sent as `Authorization: Bearer <token>` rather than cookies, specifically so the client and server can live on different domains (Vercel + Render) without SameSite cookie issues.

## Architecture

```
client (Next.js)  <--REST-->  server (Express)  <-->  MongoDB
        \                          |
         \--------Socket.IO-------/
```

- All writes go through the REST API. The API handler is the only place that validates, persists to MongoDB, writes an activity log entry, and then emits the corresponding Socket.IO event to everyone viewing that board. Sockets are never a write path on their own — this keeps one code path for authorization and validation, and means the REST API is fully usable (and testable) without a live socket connection.
- A client joins a `board:<id>` Socket.IO room after the server verifies (via the JWT in the socket handshake) that the user is actually a member of that board. Events (`task:created`, `task:updated`, `task:deleted`, `board:updated`, `board:deleted`, `activity:new`) are broadcast to that room only.
- On reconnect (dropped wifi, server restart, etc.), the client doesn't try to replay missed events — it just re-joins the room and refetches the board, tasks, and activity over REST. Simpler than an event-replay system, and correct by construction since it just re-reads current state.

## Concurrent-edit handling

This is the scenario the assignment specifically calls out: two people have the same task open, A changes the title, B changes the description before A's update reaches B.

**Approach: optimistic concurrency with a per-task `version` counter**, not last-write-wins.

- Every task has a `version` field, starting at 0.
- The client always sends the `version` it last loaded along with a `PATCH /api/tasks/:id`.
- The server does an atomic `findOneAndUpdate({ _id, version: <sent version> }, { $set: changes, $inc: { version: 1 } })`. If nothing matches — because someone else's update already bumped the version — it responds `409` with the current server copy of the task attached.
- The client rolls back its optimistic change, applies the server's current copy so nothing is silently lost, and tells the user their edit didn't go through so they can redo it against the fresh version.

Why this over the alternatives:

- **Last-write-wins** was rejected because it can silently discard one person's change (e.g. B's save could blindly overwrite A's title with a stale copy). That's the exact failure mode the assignment is testing for.
- **Field-level merging** (only conflict if the same field changed) was considered, since A and B in the example above touch different fields. It was rejected as more machinery than this scope needs, and it has its own sharp edge: merging two independent partial updates can produce a task state neither person actually intended or reviewed. Document-level versioning is simpler and forces a visible, conscious resolution instead of an invisible auto-merge.
- In practice, the realtime layer shrinks the actual conflict window a lot: because every save is broadcast immediately, B's UI already shows A's new title before B even finishes typing their description, in most real usage. The 409 path exists for the genuine race — two saves landing within the same round trip — rather than being the common case.

The same `version` check backs task moves (drag-and-drop), so a drag racing an edit is caught the same way.

## Drag-and-drop position handling

Task ordering within a column uses fractional positions (the same idea Trello's engineering blog describes): dropping a task between two siblings sets its `position` to the midpoint of theirs, dropping at an end sets it to sibling ± 1. This means a move only ever touches the one moved task — no need to re-shift every other task in the column, and no directional off-by-one bugs whether you drag up or down.

## API

```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me

POST   /api/boards
GET    /api/boards
GET    /api/boards/:id
PATCH  /api/boards/:id                  { name }
DELETE /api/boards/:id                  owner only
POST   /api/boards/:id/members          { email } — invites an already-registered user
DELETE /api/boards/:id/members/:userId  owner only
GET    /api/boards/:id/activity

POST   /api/boards/:id/tasks            { title, description?, status?, assignee?, dueDate? }
GET    /api/boards/:id/tasks            ?search=&status=&assignee=
PATCH  /api/tasks/:id                   partial update; must include { version }
DELETE /api/tasks/:id
```

All routes except register/login require `Authorization: Bearer <token>`. Errors are always `{ error: { message, code } }`, with specific codes for things like `VERSION_CONFLICT` (409), `EMAIL_TAKEN`, `INVALID_CREDENTIALS`, `FORBIDDEN`, etc.

## Error handling

- Invalid/missing/expired token → `401`.
- Acting on a board you're not a member of → `403` (checked on every board and task route, and again on the socket's `board:join`).
- Malformed ids → `400` rather than letting Mongoose throw a raw cast error.
- A centralized Express error handler catches everything (including unexpected DB errors) and returns a consistent shape instead of leaking stack traces.
- The client wraps every API call, shows inline errors instead of crashing, and the Socket.IO client's own reconnection logic (with the resync described above) handles dropped connections.

## Bonus features implemented

- Optimistic UI (task moves and edits apply locally before the server confirms, and roll back on failure/conflict).
- Reordering within a column, via the fractional-position scheme above.
- Board-member invitations (by email of an existing registered user) and a two-role permission model (owner / member — only the owner can delete the board or manage membership; any member can rename it or work with tasks).
- Search and assignee filtering on a board's tasks.
- Due dates, with an overdue indicator on the card.
- Reconnect-and-resync after a Socket.IO disconnect.
- Docker Compose for local dev; separate Dockerfiles for server and client.
- Automated integration tests for auth, board authorization, task CRUD, and the version-conflict path.

## Known limitations

- Invitations only work for people who already have an account (no email-invite flow to a non-user) — keeps the feature real without needing an SMTP/email provider for what's otherwise a self-contained app.
- JWTs aren't revocable server-side; logout just discards the client's copy. A production system would want short-lived access tokens plus a refresh flow.
- Search/filter runs as a MongoDB query per board (fine at the scale a single board reaches) rather than a dedicated search index.
- No pagination on the activity log beyond a fixed recent-N limit.
