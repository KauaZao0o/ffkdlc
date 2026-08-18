"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { useMusicPlayer } from "./MusicPlayerContext.jsx";

const PresenceContext = createContext(null);

const HEARTBEAT_MS = 45000;

// Mantém um canal de presença compartilhado por todo mundo logado - dá pra
// saber quem está online agora e o que cada um está ouvindo no player,
// sem precisar consultar o banco (tudo em tempo real via Supabase).
// Também manda um "heartbeat" pra API de tempos em tempos, só pra manter
// o "lastSeenAt" de cada um atualizado no banco (usado no perfil como
// "visto por último" pra quem não está online agora).
export function PresenceProvider({ user, children }) {
  const [onlineMap, setOnlineMap] = useState({});
  const { nowPlaying, isPlaying } = useMusicPlayer();
  const channelRef = useRef(null);

  useEffect(() => {
    if (!user) return;

    const supabase = getSupabaseBrowserClient();
    const channel = supabase.channel("presence-users", { config: { presence: { key: user.id } } });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const map = {};
        Object.entries(state).forEach(([id, entries]) => {
          const latest = entries[entries.length - 1];
          map[id] = { username: latest.username, nowPlayingTitle: latest.nowPlayingTitle || null, isPlaying: !!latest.isPlaying };
        });
        setOnlineMap(map);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ username: user.username, nowPlayingTitle: null, isPlaying: false });
        }
      });

    channelRef.current = channel;

    function sendHeartbeat() {
      fetch("/api/auth/heartbeat", { method: "POST", credentials: "include" }).catch(() => {});
    }
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, HEARTBEAT_MS);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Atualiza minha própria presença sempre que a música tocando/pausada
  // muda - assim quem olhar meu perfil vê isso ao vivo.
  useEffect(() => {
    if (!user) return;
    channelRef.current?.track({ username: user.username, nowPlayingTitle: nowPlaying?.title || null, isPlaying: !!isPlaying });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowPlaying?.title, isPlaying, user?.id]);

  return <PresenceContext.Provider value={{ onlineMap }}>{children}</PresenceContext.Provider>;
}

export function usePresence() {
  const ctx = useContext(PresenceContext);
  if (!ctx) throw new Error("usePresence precisa ser usado dentro de um PresenceProvider");
  return ctx;
}
