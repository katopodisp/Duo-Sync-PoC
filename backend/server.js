// Minimal WebSocket sync server for Duo Sync PoC - ENHANCED
require("dotenv").config();
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const Redis = require("ioredis");
const winston = require("winston");
const { RateLimiterRedis } = require('rate-limiter-flexible');
const url = require('url');

// Initialize Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "duo-sync-backend" },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" })
  ]
});

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

const rateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rate',
  points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  duration: (parseInt(process.env.RATE_LIMIT_WINDOW_MS) / 1000) || 900,
});

const sessions = new Map(); // duoId -> Map(userId -> ws)

// Middleware for Express
app.use(express.json());
app.use(async (req, res, next) => {
  try {
    await rateLimiter.consume(req.socket.remoteAddress);
    next();
  } catch (e) {
    logger.warn('Rate limit exceeded', { ip: req.socket.remoteAddress });
    res.status(429).json({ error: 'Too many requests' });
  }
});

// Health endpoint
app.get("/health", (req, res) => {
  logger.info("Health check requested");
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// Status endpoint
app.get("/status", (req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
    connectedSessions: sessions.size,
    timestamp: new Date().toISOString()
  });
});

wss.on("connection", (ws, req) => {
  const queryObject = url.parse(req.url, true).query;
  if (queryObject.apiKey !== process.env.API_KEY) {
    logger.warn("Unauthorized connection attempt");
    ws.close(1008, "Unauthorized");
    return;
  }
  logger.info("New authenticated WebSocket connection");
  ws.isAlive = true;
  ws.on("pong", () => (ws.isAlive = true));

  ws.on("message", async (raw) => {
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      logger.error("Invalid JSON received", { error: e.message });
      return;
    }

    const { type, duoId, userId, payload } = data;
    if (!duoId || !userId || !type) {
      logger.warn("Message missing required fields", { type, duoId, userId });
      return;
    }

    try {
      await rateLimiter.consume(`${duoId}:${userId}`);
    } catch (e) {
      logger.warn('WS rate limit exceeded', { duoId, userId });
      return;
    }

    logger.debug("Message received", { type, duoId, userId });

    if (type === "presence") {
      if (!sessions.has(duoId)) sessions.set(duoId, new Map());
      sessions.get(duoId).set(userId, ws);
      try {
        await redis.set(`presence:${duoId}:${userId}`, "1", "EX", 30);
        logger.info("User presence registered", { duoId, userId });
      } catch (e) {
        logger.error("Redis presence set failed", { error: e.message, duoId, userId });
      }
      notifyPeer(duoId, userId, { type: "presence", userId });
      return;
    }

    if (type === "drift_check_request") {
      ws.send(JSON.stringify({
        type: "drift_check_response",
        duoId,
        userId,
        payload: { serverTimestamp: Date.now() }
      }));
      logger.debug("Drift check response sent", { duoId, userId });
      return;
    }

    if (["play", "pause", "seek", "drift_check_response"].includes(type)) {
      forwardToPeers(duoId, userId, { type, userId, payload });
      logger.debug("Message forwarded to peers", { type, duoId, userId });
      return;
    }

    logger.warn("Unknown message type", { type, duoId, userId });
  });

  ws.on("close", () => {
    logger.info("WebSocket connection closed");
    for (const [duoId, map] of sessions.entries()) {
      for (const [uid, peerWs] of map.entries()) {
        if (peerWs === ws) {
          map.delete(uid);
          logger.info("User disconnected", { duoId, userId: uid });
          if (map.size === 0) sessions.delete(duoId);
        }
      }
    }
  });

  ws.on("error", (error) => {
    logger.error("WebSocket error", { error: error.message });
  });
});

function forwardToPeers(duoId, fromUserId, message) {
  const map = sessions.get(duoId);
  if (!map) return;
  for (const [uid, peerWs] of map.entries()) {
    if (uid === fromUserId) continue;
    if (peerWs && peerWs.readyState === WebSocket.OPEN) {
      try {
        peerWs.send(JSON.stringify(message));
      } catch (e) {
        logger.error("Send to peer failed", { error: e.message, targetUserId: uid });
      }
    }
  }
}

function notifyPeer(duoId, fromUserId, message) {
  forwardToPeers(duoId, fromUserId, message);
}

// Heartbeat interval
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`Sync server listening on port ${PORT}`, { port: PORT });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
});
