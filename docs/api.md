# Mock Game Provider API

## Close a provider session

`POST /api/sessions/:sessionId/close`

Closes an existing provider game session. The response never includes the private Casino token.

### Responses

- `200 OK` for an `ACTIVE` session: changes its status to `CLOSED`, sets `closedAt`, and returns the public session.
- `200 OK` for an already `CLOSED` session: returns the existing public session without changing `closedAt`.
- `404 Not Found` when the session does not exist:

  ```json
  { "error": "Session not found" }
  ```

- `409 Conflict` for an `EXPIRED` session: leaves the session unchanged.

  ```json
  { "error": "Expired session cannot be closed" }
  ```

### Example

```bash
curl -X POST http://localhost:8090/api/sessions/SESSION_ID/close
```
