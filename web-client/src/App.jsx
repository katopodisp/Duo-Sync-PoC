import React, { useEffect, useState } from "react";
import "./i18n";
import { useTranslation } from "react-i18next";
import "./App.css";

export default function App() {
  const { t, i18n } = useTranslation();
  const [optIn, setOptIn] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsStatus, setWsStatus] = useState("idle");
  const [messages, setMessages] = useState([]);
  const [spotifyToken, setSpotifyToken] = useState(null);
  const [player, setPlayer] = useState(null);
  const [peerOnline, setPeerOnline] = useState(false);
  const [drift, setDrift] = useState(0);
  const [duoId] = useState(`duo-${Math.random().toString(36).substring(7)}`);
  const [userId] = useState(`user-${Math.random().toString(36).substring(7)}`);
  const [ws, setWs] = useState(null);

  // Spotify OAuth implicit flow
  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const token = params.get('access_token');
    if (token) {
      setSpotifyToken(token);
      window.location.hash = '';
    }
  }, []);

  const loginToSpotify = () => {
    const scopes = 'user-read-playback-state user-modify-playback-state streaming';
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${import.meta.env.VITE_SPOTIFY_CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(import.meta.env.VITE_REDIRECT_URI)}&scope=${encodeURIComponent(scopes)}`;
    window.location.href = authUrl;
  };

  // Initialize Spotify Player SDK
  useEffect(() => {
    if (!spotifyToken) return;

    window.onSpotifyWebPlaybackSDKReady = () => {
      const p = new window.Spotify.Player({
        name: 'Duo Sync PoC',
        getOAuthToken: cb => { cb(spotifyToken); },
        volume: 0.5
      });

      p.addListener('ready', ({ device_id }) => {
        console.log('Device ready:', device_id);
      });

      p.addListener('player_state_changed', state => {
        if (state) {
          // Send state to peer if changed
          if (ws && ws.readyState === WebSocket.OPEN) {
            const payload = {
              type: state.paused ? 'pause' : 'play',
              duoId,
              userId,
              payload: {
                trackUri: state.track_window.current_track.uri,
                positionMs: state.position,
                timestampUtc: Date.now()
              }
            };
            ws.send(JSON.stringify(payload));
          }
        }
      });

      p.connect();
      setPlayer(p);
    };
  }, [spotifyToken, ws, duoId, userId]);

  // WebSocket connection
  useEffect(() => {
    if (!optIn || !spotifyToken) return;

    const syncWs = new WebSocket(`${import.meta.env.VITE_SYNC_SERVER_WS}?apiKey=${import.meta.env.VITE_API_KEY}`);

    syncWs.onopen = () => {
      console.log("WebSocket connected");
      setWsConnected(true);
      setWsStatus("connected");
      syncWs.send(JSON.stringify({
        type: "presence",
        duoId,
        userId,
        payload: { optIn: true }
      }));
      setWs(syncWs);
    };

    syncWs.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("Message received:", data);
      setMessages(prev => [...prev, data]);

      if (data.type === 'presence') {
        setPeerOnline(true);
      } else if (data.type === 'play') {
        if (player) {
          player.resume(); // Or play specific track
          player.seek(data.payload.positionMs + drift);
        }
      } else if (data.type === 'pause') {
        if (player) player.pause();
      } else if (data.type === 'seek') {
        if (player) player.seek(data.payload.positionMs + drift);
      } else if (data.type === 'drift_check_response') {
        const now = Date.now();
        setDrift(now - data.payload.serverTimestamp);
      }
    };

    syncWs.onerror = (error) => {
      console.error("WebSocket error:", error);
      setWsStatus("error");
    };

    syncWs.onclose = () => {
      console.log("WebSocket disconnected");
      setWsConnected(false);
      setWsStatus("disconnected");
      setPeerOnline(false);
    };

    const driftInterval = setInterval(() => {
      if (syncWs.readyState === WebSocket.OPEN) {
        syncWs.send(JSON.stringify({ type: 'drift_check_request', duoId, userId }));
      }
    }, 30000);

    return () => {
      clearInterval(driftInterval);
      if (syncWs.readyState === WebSocket.OPEN) {
        syncWs.close();
      }
    };
  }, [optIn, spotifyToken, player, duoId, userId]);

  // Load saved language
  useEffect(() => {
    const lang = localStorage.getItem("duo_lang");
    if (lang) i18n.changeLanguage(lang);
  }, [i18n]);

  function toggleLanguage(lang) {
    i18n.changeLanguage(lang);
    localStorage.setItem("duo_lang", lang);
  }

  return (
    <div className="app-container">
      <div className="app-card">
        <h1>{t("title")}</h1>
        <p className="subtitle">{t("subtitle")}</p>

        <div className={\`status-badge status-\${wsStatus}\`}>
          {wsConnected ? t("status_connected") : t("status_disconnected")}
        </div>

        <div className="section">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={optIn}
              onChange={() => setOptIn(!optIn)}
            />
            <span>{t("opt_in_label")}</span>
          </label>
        </div>

        {!spotifyToken && (
          <button className="btn btn-primary" onClick={loginToSpotify}>
            {t("login_spotify")}
          </button>
        )}

        {optIn && spotifyToken && (
          <div className="connection-status">
            <h3>{t("connection_status")}</h3>
            <p>
              {wsStatus === "connecting" && t("status_connecting")}
              {wsStatus === "connected" && t("status_online")}
              {wsStatus === "disconnected" && t("status_offline")}
              {wsStatus === "error" && "Connection Error"}
            </p>
            <p>{t("peer_status")}: {peerOnline ? t("online") : t("offline")}</p>
            <p>{t("drift")}: {drift} {t("ms")}</p>
          </div>
        )}

        {spotifyToken && player && (
          <div className="controls-section">
            <button className="btn btn-primary" onClick={() => player.togglePlay()}>
              {t("play")}/{t("pause")}
            </button>
            {/* Add seek input or slider here */}
          </div>
        )}

        <div className="language-section">
          <strong>{t("language")}:</strong>
          <button
            className={\`btn btn-language \${i18n.language === "en" ? "active" : ""}\`}
            onClick={() => toggleLanguage("en")}
          >
            {t("english")}
          </button>
          <button
            className={\`btn btn-language \${i18n.language === "el" ? "active" : ""}\`}
            onClick={() => toggleLanguage("el")}
          >
            {t("greek")}
          </button>
        </div>

        {messages.length > 0 && (
          <div className="debug-section">
            <h4>Recent Events ({messages.length})</h4>
            <div className="messages-list">
              {messages.slice(-5).map((msg, idx) => (
                <div key={idx} className="message-item">
                  <span className="msg-type">{msg.type}</span>
                  <span className="msg-user">{msg.userId?.substring(0, 8)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <footer className="footer">
          {t("note_dev")}
        </footer>
      </div>
    </div>
  );
}
