```env
OPERATOR_BASE_URL=http://localhost:8080
```

## Authenticate a provider session

After creating a session through `POST /api/launch`, authenticate it with an empty request body:

```bash
curl -X POST http://localhost:8090/api/sessions/SESSION_ID/authenticate
```

Successful response:

```json
{
  "sessionId": "provider-session-id",
  "playerId": "player-123",
  "currency": "EUR",
  "cash": 100.0,
  "bonus": 0.0,
  "authenticatedAt": "2026-07-19T10:00:00.000Z"
}
```

The provider reads the operator token from its internal session. The browser does not send or receive the token.

The Lucky Seven frontend is not connected to this endpoint yet.
