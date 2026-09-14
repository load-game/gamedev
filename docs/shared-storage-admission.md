# Shared storage and instance admission

`SHARED_STORAGE_DB_URI` enables PostgreSQL for keys matching comma-separated `SHARED_STORAGE_PREFIXES`. Set `SHARED_STORAGE_SCHEMA` to a non-public identifier unique to the game and chain deployment. The normal world database still owns entities, settings, and local users. Shared storage creates only a `world_storage` table in its separate schema.

Use `getFreshEntry` and `commitStorage` with `expectedUpdatedAt` for shared keys. Deferred `set`, `remove`, and unconditional shared writes are rejected. Batches spanning local and shared databases are rejected rather than partially committed. PostgreSQL commits take sorted transaction-scoped advisory locks, including for absent keys, before checking timestamps and writing. This serializes competing revisions and first creation across processes. There is no long-lived editing lease. Synchronous reads are process-local cached snapshots.

With `ADMISSION_SECRET` and a positive `PUBLIC_WORLD_MAX_PLAYERS`, every player WebSocket requires an `admissionTicket`. An authenticated internal caller posts `{sessionId}` to `/internal/admission/reserve` using `Authorization: Bearer <ADMISSION_SECRET>`. It receives a random short-lived ticket. The runtime uses the reserved session ID as the local player ID, ignoring ordinary client auth tokens for identity selection in this mode. Wallet ownership still requires the independent wallet proof.

Pending tickets last 30 seconds. Connected sessions hold their seat until disconnect, then retain it for `ADMISSION_GRACE_MS`, default 60000. Pending, connecting, connected, and grace seats count once toward capacity. Consuming a ticket invalidates it. Failed connection setup cannot hold a pending seat indefinitely. `/status.admission` reports counts and the process generation without exposing tickets or session IDs.

POST `/internal/admission/drain` with the internal secret to stop new reservations. Existing grace reservations can reconnect. Hosting idle checks include all admission seats. `WORLD_READY_FILE`, when configured, keeps public status and admission unavailable until a world importer creates the marker; engine health/admin remain available during import. With this marker configured, the world entry point must notify the hosting adapter after importing; the engine skips its earlier hosting Ready call.

Set `PUBLIC_JOIN_URL` for the browser to POST for `{wsUrl,ticket}` before connecting. Cookies carry the gateway session; a per-tab identifier separates browser tabs. An established connection's reconnect reloads the scene before assignment to avoid carrying old entities into another instance. Keep the join endpoint same-origin and keep internal admission/admin routes private.

Run PostgreSQL integration tests with `TEST_POSTGRES_URL` set to an isolated test database. Tests create and drop unique schemas. Never use a production role for this test.
