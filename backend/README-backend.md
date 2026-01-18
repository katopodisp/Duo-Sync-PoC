# Backend for Duo Sync PoC

WebSocket synchronization server for coordinating playback across multiple Spotify clients.

## Features
- WebSocket-based real-time messaging
- Redis session persistence
- Winston logging (file + console)
- Health check & status endpoints
- Automatic peer discovery
- Basic auth with API key
- Rate limiting
- Drift check support

## Environment Variables
```
REDIS_URL        - Redis connection URL (default: redis://localhost:6379)
REDIS_DB         - Redis database number (default: 0)
PORT             - Server port (default: 3000)
NODE_ENV         - development|production (default: development)
LOG_LEVEL        - debug|info|warn|error (default: info)
CORS_ORIGIN      - CORS allowed origin (default: http://localhost:5173)
RATE_LIMIT_WINDOW_MS - Rate limit window in ms (default: 900000)
RATE_LIMIT_MAX_REQUESTS - Max requests per window (default: 100)
API_KEY          - Secret key for WS auth
```

## Installation & Running
```bash
npm install
npm start
```

### Development
```bash
npm run dev
```

## WebSocket Connection
Connect with ?apiKey=your-secret-key in the WS URL.

## Message Format
```json
{
  "type": "play|pause|seek|presence|drift_check_request|drift_check_response",
  "duoId": "session-id",
  "userId": "user-id",
  "payload": {
    "trackUri": "spotify:track:...",
    "positionMs": 12345,
    "timestampUtc": 1705574400000,
    "serverTimestamp": 1705574400000 // for drift
  }
}
