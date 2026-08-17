"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { parseYoutubeInput, fetchYoutubeInfo } from "@/lib/youtube";

const MusicPlayerContext = createContext(null);

const FAVORITES_KEY = "ffpkdlc-music-favorites";
const VOLUME_KEY = "ffpkdlc-music-volume";
const POSITION_KEY = "ffpkdlc-music-position";
const MINIMIZED_KEY = "ffpkdlc-music-minimized";

function loadFavorites() {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
  } catch {
    return [];
  }
}

// unescape/escape aqui só servem pra deixar o base64 seguro pra texto com
// acento (título de vídeo) - o btoa puro não aceita caracteres fora do
// intervalo Latin1.
function toBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function fromBase64(str) {
  return decodeURIComponent(escape(atob(str)));
}

// A API do YouTube só pode ser carregada uma vez por página - esse cache
// evita injetar o script de novo se o player for aberto/fechado várias
// vezes, ou se dois componentes tentarem inicializar ao mesmo tempo.
let ytApiPromise = null;
function loadYoutubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT);
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return ytApiPromise;
}

// Toda a lógica do player de música fica isolada aqui e montada uma única
// vez na página do chat (igual ao CallProvider) - assim a música continua
// tocando trocando de conversa ou abrindo/fechando o painel do player, só
// para de verdade quando a pessoa desloga.
export function MusicPlayerProvider({ children }) {
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [nowPlaying, setNowPlaying] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(70);
  const [favorites, setFavorites] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addError, setAddError] = useState("");
  const [position, setPosition] = useState(null); // {x, y} - null até calcular a posição inicial no cliente
  const [minimized, setMinimized] = useState(false);

  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const wrapperRef = useRef(null);
  const queueRef = useRef([]);
  const currentIndexRef = useRef(null);
  const volumeRef = useRef(70);
  const dragRef = useRef(null);

  useEffect(() => {
    setFavorites(loadFavorites());
    const stored = localStorage.getItem(VOLUME_KEY);
    if (stored !== null) {
      const savedVolume = Number(stored);
      if (savedVolume >= 0 && savedVolume <= 100) {
        setVolumeState(savedVolume);
        volumeRef.current = savedVolume;
      }
    }

    setMinimized(localStorage.getItem(MINIMIZED_KEY) === "1");

    const storedPosition = localStorage.getItem(POSITION_KEY);
    if (storedPosition) {
      try {
        const parsed = JSON.parse(storedPosition);
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          setPosition(clampPosition(parsed.x, parsed.y));
          return;
        }
      } catch {
        // ignora posição salva corrompida - usa o padrão abaixo
      }
    }

    // Padrão: canto inferior direito, igual ao comportamento antigo.
    const w = window.innerWidth < 768 ? 170 : 220;
    setPosition(clampPosition(window.innerWidth - w - 16, window.innerHeight - 190));
  }, []);

  useEffect(() => {
    if (position) localStorage.setItem(POSITION_KEY, JSON.stringify(position));
  }, [position]);

  useEffect(() => {
    localStorage.setItem(MINIMIZED_KEY, minimized ? "1" : "0");
  }, [minimized]);

  // Se a janela encolher (ex: girar o celular) e o player ficar preso fora
  // da tela, reposiciona ele de volta pra dentro da área visível.
  useEffect(() => {
    function handleResize() {
      setPosition((prev) => (prev ? clampPosition(prev.x, prev.y) : prev));
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function clampPosition(x, y) {
    const rect = wrapperRef.current?.getBoundingClientRect();
    const w = rect?.width || (window.innerWidth < 768 ? 170 : 220);
    const h = rect?.height || 190;
    const maxX = Math.max(window.innerWidth - w - 4, 4);
    const maxY = Math.max(window.innerHeight - h - 4, 4);
    return { x: Math.min(Math.max(x, 4), maxX), y: Math.min(Math.max(y, 4), maxY) };
  }

  function handleDragPointerDown(e) {
    if (!position) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: position.x, originY: position.y };
    window.addEventListener("pointermove", handleDragPointerMove);
    window.addEventListener("pointerup", handleDragPointerUp);
  }

  function handleDragPointerMove(e) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPosition(clampPosition(dragRef.current.originX + dx, dragRef.current.originY + dy));
  }

  function handleDragPointerUp() {
    dragRef.current = null;
    window.removeEventListener("pointermove", handleDragPointerMove);
    window.removeEventListener("pointerup", handleDragPointerUp);
  }

  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    return () => {
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, []);

  // Atualiza o tempo atual/duração pra alimentar a barra de progresso -
  // só enquanto algo está tocando, pra não ficar chamando a API à toa.
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      setCurrentTime(player.getCurrentTime?.() || 0);
      setDuration(player.getDuration?.() || 0);
    }, 500);
    return () => clearInterval(interval);
  }, [isPlaying]);

  function ensurePlayer() {
    if (playerRef.current) return Promise.resolve(playerRef.current);
    return loadYoutubeApi().then(
      (YT) =>
        new Promise((resolve) => {
          const player = new YT.Player(containerRef.current, {
            height: "100%",
            width: "100%",
            playerVars: { rel: 0 },
            events: {
              onReady: () => {
                player.setVolume(volumeRef.current);
                playerRef.current = player;
                resolve(player);
              },
              onStateChange: (e) => {
                if (e.data === YT.PlayerState.PLAYING) {
                  setIsPlaying(true);
                  const data = player.getVideoData?.();
                  if (data?.title) setNowPlaying({ title: data.title, author: data.author });
                } else if (e.data === YT.PlayerState.PAUSED) {
                  setIsPlaying(false);
                } else if (e.data === YT.PlayerState.ENDED) {
                  advance(1);
                }
              },
            },
          });
        })
    );
  }

  function playQueueItem(index) {
    const item = queueRef.current[index];
    if (!item) return;
    currentIndexRef.current = index;
    setCurrentIndex(index);
    setNowPlaying({ title: item.title, author: item.author });
    setCurrentTime(0);
    setDuration(0);

    ensurePlayer().then((player) => {
      if (item.type === "playlist") {
        player.loadPlaylist({ list: item.id, listType: "playlist", index: 0 });
      } else {
        player.loadVideoById(item.id);
      }
    });
  }

  function advance(step) {
    const idx = currentIndexRef.current;
    if (idx === null) return;
    const nextIdx = idx + step;
    if (nextIdx < 0 || nextIdx >= queueRef.current.length) {
      playerRef.current?.stopVideo?.();
      setIsPlaying(false);
      return;
    }
    playQueueItem(nextIdx);
  }

  async function addToQueue(rawInput) {
    setAddError("");
    const parsed = parseYoutubeInput(rawInput);
    if (!parsed) {
      setAddError("Link ou ID inválido.");
      return false;
    }

    const shouldAutoplay = currentIndexRef.current === null;
    const newIndex = queueRef.current.length;
    const item = { key: `${parsed.type}-${parsed.id}-${Date.now()}`, ...parsed, title: "Carregando...", author: "" };

    queueRef.current = [...queueRef.current, item];
    setQueue(queueRef.current);

    fetchYoutubeInfo(parsed).then((info) => {
      if (!info) return;
      queueRef.current = queueRef.current.map((q) => (q.key === item.key ? { ...q, ...info } : q));
      setQueue(queueRef.current);
      if (currentIndexRef.current !== null && queueRef.current[currentIndexRef.current]?.key === item.key) {
        setNowPlaying({ title: info.title, author: info.author });
      }
    });

    if (shouldAutoplay) playQueueItem(newIndex);

    return true;
  }

  function removeFromQueue(key) {
    const idx = queueRef.current.findIndex((q) => q.key === key);
    if (idx === -1) return;
    const wasCurrent = idx === currentIndexRef.current;

    queueRef.current = queueRef.current.filter((q) => q.key !== key);
    setQueue(queueRef.current);

    if (queueRef.current.length === 0) {
      playerRef.current?.stopVideo?.();
      currentIndexRef.current = null;
      setCurrentIndex(null);
      setIsPlaying(false);
      setNowPlaying(null);
      return;
    }

    if (wasCurrent) {
      playQueueItem(Math.min(idx, queueRef.current.length - 1));
    } else if (currentIndexRef.current !== null && idx < currentIndexRef.current) {
      currentIndexRef.current -= 1;
      setCurrentIndex(currentIndexRef.current);
    }
  }

  function clearQueue() {
    playerRef.current?.stopVideo?.();
    queueRef.current = [];
    setQueue([]);
    currentIndexRef.current = null;
    setCurrentIndex(null);
    setIsPlaying(false);
    setNowPlaying(null);
    setCurrentTime(0);
    setDuration(0);
  }

  // Para o vídeo atual sem tirá-lo da fila - diferente de "remover", que
  // apaga o item da lista. Só encerra o que está tocando agora.
  function closeVideo() {
    playerRef.current?.stopVideo?.();
    currentIndexRef.current = null;
    setCurrentIndex(null);
    setIsPlaying(false);
    setNowPlaying(null);
    setCurrentTime(0);
    setDuration(0);
  }

  function seekTo(time) {
    playerRef.current?.seekTo?.(time, true);
    setCurrentTime(time);
  }

  function playPause() {
    if (!playerRef.current) {
      if (queueRef.current.length > 0) playQueueItem(0);
      return;
    }
    if (isPlaying) playerRef.current.pauseVideo();
    else playerRef.current.playVideo();
  }

  function next() {
    advance(1);
  }

  function prev() {
    // Depois de alguns segundos tocando, "anterior" reinicia a música
    // atual em vez de voltar pra fila - igual ao comportamento padrão de
    // qualquer tocador de música.
    const current = playerRef.current?.getCurrentTime?.() || 0;
    if (current > 3) {
      playerRef.current.seekTo(0);
      return;
    }
    advance(-1);
  }

  function setVolume(v) {
    volumeRef.current = v;
    setVolumeState(v);
    localStorage.setItem(VOLUME_KEY, String(v));
    playerRef.current?.setVolume(v);
  }

  function isFavorite(type, id) {
    return favorites.some((f) => f.type === type && f.id === id);
  }

  function toggleFavorite(item) {
    setFavorites((prev) => {
      const exists = prev.some((f) => f.type === item.type && f.id === item.id);
      if (exists) return prev.filter((f) => !(f.type === item.type && f.id === item.id));
      return [...prev, { type: item.type, id: item.id, title: item.title, author: item.author }];
    });
  }

  function removeFavorite(type, id) {
    setFavorites((prev) => prev.filter((f) => !(f.type === type && f.id === id)));
  }

  function generateCode() {
    return toBase64(JSON.stringify(favorites));
  }

  function loadCode(code) {
    try {
      const parsed = JSON.parse(fromBase64(code.trim()));
      if (!Array.isArray(parsed)) throw new Error("formato inválido");
      const valid = parsed.filter((f) => f && typeof f.id === "string" && (f.type === "video" || f.type === "playlist"));

      setFavorites((prev) => {
        const merged = [...prev];
        valid.forEach((f) => {
          if (!merged.some((m) => m.type === f.type && m.id === f.id)) {
            merged.push({ type: f.type, id: f.id, title: f.title || f.id, author: f.author || "" });
          }
        });
        return merged;
      });

      return { ok: true, count: valid.length };
    } catch {
      return { ok: false, count: 0 };
    }
  }

  function playFavorite(fav) {
    addToQueue(fav.type === "playlist" ? `https://www.youtube.com/playlist?list=${fav.id}` : fav.id);
  }

  // O mini-player só fica visível enquanto existe um vídeo selecionado -
  // fechar o vídeo (closeVideo) some com ele até a pessoa tocar outra
  // música, mesmo que a fila continue com itens guardados.
  const hasActiveVideo = currentIndex !== null;

  const value = {
    queue,
    currentIndex,
    isPlaying,
    nowPlaying,
    currentTime,
    duration,
    volume,
    favorites,
    drawerOpen,
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
    openDrawer: () => setDrawerOpen(true),
    closeDrawer: () => setDrawerOpen(false),
  };

  return (
    <MusicPlayerContext.Provider value={value}>
      {children}

      <div
        ref={wrapperRef}
        className={`music-mini-player ${hasActiveVideo ? "" : "music-mini-player-empty"}`}
        style={position ? { left: position.x, top: position.y, right: "auto", bottom: "auto" } : undefined}
      >
        {hasActiveVideo && (
          <div className="music-mini-player-header" onPointerDown={handleDragPointerDown}>
            <span className="music-mini-player-title">{nowPlaying?.title || ""}</span>
            <button
              onClick={() => setMinimized((m) => !m)}
              title={minimized ? "Maximizar" : "Minimizar"}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {minimized ? "▢" : "—"}
            </button>
          </div>
        )}

        <div className="music-mini-player-frame-wrap" style={{ height: minimized ? 0 : "auto" }}>
          <div ref={containerRef} className="music-mini-player-frame" />
        </div>

        {hasActiveVideo && (
          <div className="music-mini-player-controls">
            <button onClick={prev} title="Anterior">⏮</button>
            <button onClick={playPause} title={isPlaying ? "Pausar" : "Tocar"}>
              {isPlaying ? "⏸" : "▶️"}
            </button>
            <button onClick={next} title="Próxima">⏭</button>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="music-mini-player-volume"
              title="Volume"
            />
          </div>
        )}
      </div>
    </MusicPlayerContext.Provider>
  );
}

export function useMusicPlayer() {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx) throw new Error("useMusicPlayer precisa ser usado dentro de um MusicPlayerProvider");
  return ctx;
}
