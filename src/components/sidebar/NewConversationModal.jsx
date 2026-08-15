"use client";

import { useEffect, useState } from "react";
import Avatar from "@/components/common/Avatar.jsx";

export default function NewConversationModal({ onClose, onStarted }) {
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [startingId, setStartingId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/users", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setError("Não foi possível carregar os usuários."))
      .finally(() => setLoadingUsers(false));
  }, []);

  async function handlePick(otherUserId) {
    setError("");
    setStartingId(otherUserId);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ otherUserId }),
      });

      let data = null;
      try {
        data = await res.json();
      } catch {
        // resposta sem corpo JSON
      }

      if (!res.ok) {
        setError(data?.error || `Erro ao iniciar conversa (status ${res.status}).`);
        return;
      }

      onStarted(data.id);
    } catch {
      setError("Falha de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setStartingId(null);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--surface)", color: "var(--text)", borderRadius: 12, padding: 24, width: 320, maxWidth: "85vw" }}
      >
        <h3 style={{ marginTop: 0 }}>Nova conversa</h3>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: -8, marginBottom: 12 }}>
          Escolha alguém para começar a conversar.
        </p>

        <div style={{ maxHeight: 280, overflowY: "auto", marginBottom: 16 }}>
          {loadingUsers && <p style={{ fontSize: 13, color: "var(--text-faint)" }}>Carregando...</p>}

          {!loadingUsers && users.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--text-faint)" }}>Nenhum outro usuário cadastrado ainda.</p>
          )}

          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => handlePick(u.id)}
              disabled={startingId !== null}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                textAlign: "left",
                border: "none",
                borderRadius: 8,
                padding: "8px 6px",
                background: "transparent",
                marginBottom: 2,
              }}
            >
              <Avatar username={u.username} avatarColor={u.avatarColor} avatarUrl={u.avatarUrl} size={34} />
              <span style={{ flex: 1, fontSize: 14 }}>{u.username}</span>
              {u.isOnline && (
                <span
                  title="Online"
                  style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--success)", flexShrink: 0 }}
                />
              )}
              {startingId === u.id && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>abrindo...</span>}
            </button>
          ))}
        </div>

        {error && <p style={{ color: "#e5484d", fontSize: 13, marginBottom: 12 }}>{error}</p>}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} disabled={startingId !== null}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
