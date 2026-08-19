"use client";

import { useEffect, useState } from "react";
import { usePresence } from "@/context/PresenceContext.jsx";
import Avatar from "@/components/common/Avatar.jsx";

function formatDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function UserProfileModal({ username, onClose }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const { onlineMap } = usePresence();

  useEffect(() => {
    setProfile(null);
    setError("");
    fetch(`/api/users/${encodeURIComponent(username)}`, { credentials: "include" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Usuário não encontrado.");
        setProfile(data);
      })
      .catch((err) => setError(err.message));
  }, [username]);

  const presence = profile ? onlineMap[profile.id] : null;
  const isOnline = !!presence;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          color: "var(--text)",
          borderRadius: 16,
          padding: 28,
          width: 320,
          maxWidth: "85vw",
          margin: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ fontSize: 12, padding: "2px 8px" }} title="Fechar">
            ✕
          </button>
        </div>

        {error && <p style={{ color: "var(--danger)", fontSize: 14, textAlign: "center" }}>{error}</p>}

        {!error && !profile && <p style={{ textAlign: "center", color: "var(--text-faint)" }}>Carregando...</p>}

        {profile && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, marginTop: -8 }}>
            <Avatar
              username={profile.username}
              avatarColor={profile.avatarColor}
              avatarUrl={profile.avatarUrl}
              size={80}
              isOnline={isOnline}
            />

            <h3 style={{ margin: "12px 0 0" }}>{profile.username}</h3>

            <p style={{ fontSize: 13, color: isOnline ? "var(--success)" : "var(--text-faint)", margin: "4px 0 0" }}>
              {isOnline ? "Online agora" : profile.lastSeenAt ? `Visto por último em ${formatDate(profile.lastSeenAt)}` : "Nunca esteve online"}
            </p>

            {isOnline && presence?.nowPlayingTitle && (
              <p
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  margin: "8px 0 0",
                  textAlign: "center",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {presence.isPlaying ? "🎵" : "⏸"} {presence.isPlaying ? "Ouvindo agora:" : "Player pausado:"} {presence.nowPlayingTitle}
              </p>
            )}

            <div style={{ width: "100%", marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <p style={{ fontSize: 12, color: "var(--text-faint)", margin: 0 }}>Conta criada em</p>
              <p style={{ fontSize: 13, margin: "2px 0 0" }}>{formatDate(profile.createdAt)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
