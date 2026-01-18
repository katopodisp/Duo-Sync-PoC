const WebSocket = require("ws");

const SYNC_SERVER = process.env.SYNC_SERVER_WS || "ws://localhost:3000";
const API_KEY = process.env.API_KEY || "your-secret-key";
const DUO_ID = "test-duo-1";
const USER_A = "user-a";
const USER_B = "user-b";

console.log(`[Test] Connecting to ${SYNC_SERVER}?apiKey=${API_KEY}`);

function connect(userId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${SYNC_SERVER}?apiKey=${API_KEY}`);
    
    ws.on("open", () => {
      console.log(`[${userId}] Connected to server`);
      ws.send(JSON.stringify({
        type: "presence",
        duoId: DUO_ID,
        userId,
        payload: { optIn: true }
      }));
      resolve(ws);
    });

    ws.on("error", (err) => {
      console.error(`[${userId}] Connection error:`, err.message);
      reject(err);
    });
  });
}

(async () => {
  try {
    console.log("========== Drift Test PoC ==========
");

    const a = await connect(USER_A);
    const b = await connect(USER_B);

    let eventCount = 0;
    b.on("message", (msg) => {
      eventCount++;
      const data = JSON.parse(msg);
      
      if (data.type === "play") {
        const now = Date.now();
        const sentTs = data.payload.timestampUtc;
        const drift = now - sentTs;
        
        console.log(`[${USER_B}] Received play event from ${USER_A}`);
        console.log(`  Calculated drift: ${drift}ms`);
        console.log(`  Track: ${data.payload.trackUri}`);
        console.log(`  Position: ${data.payload.positionMs}ms
`);
        
        if (drift > 100) {
          console.error(`High drift detected: ${drift}ms`);
          process.exit(1);
        }
      }
    });

    const payload = {
      type: "play",
      duoId: DUO_ID,
      userId: USER_A,
      payload: {
        trackUri: "spotify:track:EXAMPLE_TRACK_URI",
        positionMs: 12345,
        timestampUtc: Date.now()
      }
    };

    console.log(`[${USER_A}] Sending play event...`);
    a.send(JSON.stringify(payload));

    setTimeout(() => {
      console.log(`
========== Test Complete ==========`);
      console.log(`Total events received: ${eventCount}`);
      if (eventCount === 0) process.exit(1);
      
      a.close();
      b.close();
      
      process.exit(0);
    }, 3000);

  } catch (error) {
    console.error("Test failed:", error.message);
    process.exit(1);
  }
})();
