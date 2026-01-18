# Spotify Duo Synchronized Listening ♥

Proof-of-concept for an open-source synchronized listening experience for Spotify Duo.

**Authors:** Panagiotis Katopodis; MS Copilot; Claude (Anthropic); Grok (xAI)

**Note:** This code is a proof-of-concept and has not undergone a full developer audit.
Developed with the assistance of MS Copilot, Claude AI, and Grok.

---

## Contents

- `backend/` - WebSocket sync server (Node.js + Express + Winston logging)
- `web-client/` - React app with WebSocket & Spotify Web API / Web Playback SDK
- `infra/` - docker-compose for Redis + Dockerfile for services
- `tests/` - integration tests PoC
- `ci/` - GitHub Actions workflow

## Quick start (development)

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- Git & GitHub CLI (for upload)

### 1. Start Redis
```
cd infra
docker-compose up -d
```

### 2. Backend
```
cd backend
npm install
npm run dev
```

Server listens on `ws://localhost:3000`

### 3. Web client
```
cd web-client
npm install
npm run dev
```

Client runs on `http://localhost:5173`

### 4. Configure OAuth credentials
1. Visit https://developer.spotify.com/dashboard
2. Create an app and get `CLIENT_ID`
3. Create `.env` file in `web-client/`:
```
VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id
VITE_REDIRECT_URI=http://localhost:5173/callback
VITE_SYNC_SERVER_WS=ws://localhost:3000
VITE_APP_BASE_URL=http://localhost:5173
VITE_API_KEY=your-secret-key
```

4. Required scopes:
   - `user-read-playback-state`
   - `user-modify-playback-state`
   - `streaming`

## Docker Deployment

### Full Stack with Docker Compose
```
docker-compose up
```

## Testing

### Run Integration Tests
```
cd tests/integration
node drift-test.js
```

## License

MIT License © 2026 Panagiotis Katopodis; MS Copilot; Claude (Anthropic); Grok (xAI)

See `LICENSE` file for details.
