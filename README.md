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

Spin starts only after the operator accepts the Bet callback. When the animation finishes, the game sends the calculated gross win to the Result endpoint and displays the final balance returned by the operator.

The game does not read or persist the wallet balance in browser storage.

## Place a bet

The browser sends only the selected amount:

```http
POST /api/sessions/SESSION_ID/bet
Content-Type: application/json

{
  "amount": 1.00
}
```

The provider builds and sends this JSON callback to `POST ${OPERATOR_BASE_URL}/api/provider-wallet/bet`:

```json
{
  "userId": "player-123",
  "gameId": "NOVA_SEVEN",
  "roundId": "provider-round-id",
  "amount": 1.00,
  "reference": "provider-bet-reference",
  "providerId": "NOVA_REELS",
  "timestamp": 1780000000000,
  "roundDetails": "spin",
  "platform": "WEB",
  "language": "en",
  "token": "operator-generated-token",
  "ipAddress": "127.0.0.1"
}
```

Expected operator response:

```json
{
  "transactionId": "operator-transaction-id",
  "currency": "EUR",
  "cash": 999.00,
  "bonus": 0.00,
  "usedPromo": 0.00,
  "error": 0,
  "description": "Success"
}
```

Frontend response:

```json
{
  "roundId": "provider-round-id",
  "transactionId": "operator-transaction-id",
  "reference": "provider-bet-reference",
  "amount": 1.00,
  "currency": "EUR",
  "cash": 999.00,
  "bonus": 0.00,
  "usedPromo": 0.00,
  "status": "BET_ACCEPTED"
}
```

The operator is the source of truth for the wallet balance. Rounds and successful Bet responses used for basic reference idempotency are stored in memory and are lost when the provider restarts.

## Complete a round with Result

After the spin animation calculates the win, the browser completes the existing round:

```http
POST /api/rounds/ROUND_ID/result
Content-Type: application/json

{
  "amount": 500.00,
  "roundDetails": "spin"
}
```

`amount` is the gross win credited by the operator. A value of `0` completes a losing round without adding funds. The previous Bet is not subtracted from this amount.

The provider sends this JSON callback to `POST ${OPERATOR_BASE_URL}/api/provider-wallet/result`:

```json
{
  "userId": "player-123",
  "gameId": "NOVA_SEVEN",
  "roundId": "provider-round-id",
  "amount": 500.00,
  "reference": "provider-result-reference",
  "providerId": "NOVA_REELS",
  "timestamp": 1780000001000,
  "roundDetails": "spin",
  "platform": "WEB",
  "token": "operator-generated-token"
}
```

Expected operator response:

```json
{
  "transactionId": "operator-result-transaction-id",
  "currency": "EUR",
  "cash": 1480.00,
  "bonus": 0.00,
  "error": 0,
  "description": "Success"
}
```

Frontend response:

```json
{
  "roundId": "provider-round-id",
  "transactionId": "operator-result-transaction-id",
  "reference": "provider-result-reference",
  "amount": 500.00,
  "currency": "EUR",
  "cash": 1480.00,
  "bonus": 0.00,
  "status": "COMPLETED"
}
```

Bet and Result use the same `roundId`, but each has its own generated reference. A repeated Result request for a completed round returns the stored response and does not call the operator or credit the win again.

The frontend never calculates the wallet balance. It displays the Bet balance and then replaces it with the final Result balance returned by the operator. Result references and responses are kept only in memory and are lost when the provider restarts.

This mock uses JSON for readability instead of Pragmatic-style form-urlencoded requests. Refund and EndRound are not implemented yet.
