"use client";

import { useState } from "react";
import { useMusicPlayer } from "@/context/MusicPlayerContext.jsx";

export default function MusicPlayerDrawer({ onClose }) {
  const {
    queue,
    currentIndex,
    isPlaying,
    currentTime,
    duration,
    volume,
    favorites,
    addError,
    addToQueue,
    removeFromQueue,
    clearQueue,
    closeVideo,
    seekTo,
    playQueueItem,
    playPause,
    next,
    prev,
    setVolume,
    isFavorite,
    toggleFavorite,
    removeFavorite,
    generateCode,
    loadCode,
    playFavorite,
  } = useMusicPlayer();

  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState("");
  const [codeMsg, setCodeMsg] = useState("");
  const [showCode, setShowCode] = useState("");

  const current = currentIndex !== null ? queue[currentIndex] : null;

  function formatTime(seconds) {
    if (!seconds || !isFinite(seconds)) return "0:00";
    const total = Math.floor(seconds);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!input.trim()) return;
    setAdding(true);
    const ok = await addToQueue(input.trim());
    setAdding(false);
    if (ok) setInput("");
  }

  function handleLoadCode() {
    if (!code.trim()) return;
    const result = loadCode(code);
    setCodeMsg(result.ok ? `${result.count} favorito(s) importado(s).` : "Código inválido.");
    if (result.ok) setCode("");
  }

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()} style={{ width: 340 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>🎵 Player</h3>
          <button onClick={onClose} style={{ fontSize: 12, padding: "2px 8px" }} title="Fechar">
            ✕
          </button>
        </div>

        <form onSubmit={handleAdd} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Link normal, youtu.be, shorts, embed, ID ou playlist"
            style={{ flex: 1, minWidth: 0 }}
          />
          <button type="submit" className="primary" disabled={adding}>
            {adding ? "..." : "Adicionar"}
          </button>
        </form>
        {addError && <p style={{ color: "var(--danger)", fontSize: 12, margin: "0 0 8px" }}>{addError}</p>}

        <div style={{ margin: "16px 0", padding: 10, background: "var(--surface-hover)", borderRadius: 8 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {current ? current.title : "Nenhuma música tocando"}
              </p>
              {current?.author && (
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-faint)" }}>{current.author}</p>
              )}
            </div>
            {current && (
              <button onClick={closeVideo} title="Fechar vídeo" style={{ fontSize: 12, flexShrink: 0, color: "var(--danger)" }}>
                ✕
              </button>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
            <span style={{ fontSize: 11, color: "var(--text-faint)", width: 32, textAlign: "right", flexShrink: 0 }}>
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min="0"
              max={duration || 0}
              step="1"
              value={Math.min(currentTime, duration || 0)}
              onChange={(e) => seekTo(Number(e.target.value))}
              disabled={!current || !duration}
              style={{ flex: 1, minWidth: 0 }}
              title="Posição do vídeo"
            />
            <span style={{ fontSize: 11, color: "var(--text-faint)", width: 32, flexShrink: 0 }}>
              {formatTime(duration)}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
            <button onClick={prev} title="Anterior">⏮</button>
            <button onClick={playPause} title={isPlaying ? "Pausar" : "Tocar"}>
              {isPlaying ? "⏸" : "▶️"}
            </button>
            <button onClick={next} title="Próxima">⏭</button>
            <span style={{ fontSize: 14, flexShrink: 0 }} title="Volume">
              {volume === 0 ? "🔇" : "🔊"}
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              style={{ flex: 1, minWidth: 0 }}
              title="Volume"
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>Fila ({queue.length})</p>
          {queue.length > 0 && (
            <button onClick={clearQueue} style={{ fontSize: 12 }}>
              Limpar fila
            </button>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 20, maxHeight: 180, overflowY: "auto" }}>
          {queue.length === 0 && <p style={{ fontSize: 12, color: "var(--text-faint)" }}>Nenhuma música na fila.</p>}
          {queue.map((item, idx) => (
            <div
              key={item.key}
              onClick={() => playQueueItem(idx)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 8px",
                borderRadius: 6,
                cursor: "pointer",
                background: idx === currentIndex ? "var(--surface-hover)" : "transparent",
              }}
            >
              <span style={{ flex: 1, fontSize: 13, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.type === "playlist" ? "📃 " : ""}
                {item.title}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(item);
                }}
                title="Favoritar"
                style={{ fontSize: 12, flexShrink: 0 }}
              >
                {isFavorite(item.type, item.id) ? "★" : "☆"}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFromQueue(item.key);
                }}
                title="Remover"
                style={{ color: "var(--danger)", fontSize: 12, flexShrink: 0 }}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 500 }}>Favoritos ({favorites.length})</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16, maxHeight: 140, overflowY: "auto" }}>
          {favorites.length === 0 && <p style={{ fontSize: 12, color: "var(--text-faint)" }}>Nenhum favorito ainda.</p>}
          {favorites.map((f) => (
            <div key={`${f.type}-${f.id}`} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px" }}>
              <span style={{ flex: 1, fontSize: 13, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {f.type === "playlist" ? "📃 " : ""}
                {f.title}
              </span>
              <button onClick={() => playFavorite(f)} title="Tocar" style={{ fontSize: 12, flexShrink: 0 }}>
                ▶️
              </button>
              <button
                onClick={() => removeFavorite(f.type, f.id)}
                title="Remover dos favoritos"
                style={{ color: "var(--danger)", fontSize: 12, flexShrink: 0 }}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 500 }}>Backup dos favoritos</p>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button onClick={() => setShowCode(generateCode())} style={{ flex: 1, fontSize: 12 }}>
            Gerar código
          </button>
        </div>
        {showCode && (
          <textarea
            readOnly
            value={showCode}
            onClick={(e) => e.target.select()}
            style={{ width: "100%", fontSize: 11, marginBottom: 8, height: 50, resize: "none" }}
          />
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Colar código"
            style={{ flex: 1, minWidth: 0 }}
          />
          <button onClick={handleLoadCode} style={{ fontSize: 12 }}>
            Carregar código
          </button>
        </div>
        {codeMsg && <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>{codeMsg}</p>}
      </div>
    </div>
  );
}
