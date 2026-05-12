# Maxitom API & Delivery Protocol

## Raw Delivery Protocol (`/raw/:id`)

Maxitom does not just serve plain text Lua (unless specifically requested/configured). It supports **Maxitom RVM (Register Virtual Machine)**.

When a client executes a Maxitom script, the typical flow is:

1. **Client requests the Loader**: `GET /raw/:id`
   - If the script is protected (Anti-Skid), the server returns the **Loader Source**.
   - The Loader has embedded timestamps and hashes.
2. **Client executes Loader**:
   - The loader sends a `POST /raw/:id` with `X-M-Op: get_loader` and the `X-M-A` signature.
   - Maxitom validates the timestamp and signature to prevent replay attacks and returns the **Secure Bootstrapper**.
3. **Bootstrapper connects to API**:
   - Sends a `POST /raw/:id` request with the final dynamically generated `X-M-A` auth header.
   - Maxitom verifies the executor HWID, checks the `authorized_clients` session, and ratelimits.
   - If valid, Maxitom returns the actual script payload, XOR-encrypted against the HWID and Auth Hash.
4. **RVM Execution**:
   - The encrypted payload is decrypted by the RVM engine inside the client's executor.
   - The payload consists of instruction packets `[{o: OPCODE, d: DATA}]` (e.g., `PUSH`, `EXEC`, `CALL`).

## Standard Script API Endpoints

- `GET /api/scripts` - List all scripts.
- `POST /api/upload` - Upload a new script.
- `GET /api/script/:id/status` - Gets the real-time kill-switch/remote-message status for a script (Used by long-polling clients).
- `POST /api/user/:id/action` - Kick or send a message to a specific user active on the script.
