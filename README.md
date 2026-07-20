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

## Game startup flow

The Lucky Seven frontend now:

1. Reads `sessionId` from the launch URL.
2. Verifies that the provider session is `ACTIVE`.
3. Calls `POST /api/sessions/:sessionId/authenticate` without a request body.
4. Uses the operator `cash` as the initial game balance and displays its currency.
5. Loads the gameplay script only after authentication succeeds.

Spin still uses the local visual demo and does not change the operator cash balance. Bet and Result callbacks are not connected yet.

The game does not read or persist the wallet balance in browser storage.
