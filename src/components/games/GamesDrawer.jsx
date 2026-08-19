"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext.jsx";
import { usePresence } from "@/context/PresenceContext.jsx";
import { useGame } from "@/context/GameContext.jsx";
import Avatar from "@/components/common/Avatar.jsx";

// Painel de jogos - hoje só tem o jogo da velha, mas a lista já fica
// pronta pra crescer no futuro. Escolhido o jogo, mostra quem está online
// agora pra desafiar (só dá pra jogar com quem está conectado, já que o
// desafio é em tempo real).
export default function GamesDrawer({ onClose }) {
  const { user } = useAuth();
  const { onlineMap } = usePresence();
  const { outgoingChallenge, sendChallenge, cancelChallenge } = useGame();
  const [users, setUsers] = useState([]);

  // Busca pela lista "de verdade" (a mesma da pesquisa/nova conversa) em
  // vez de usar a presença crua - ela já exclui a própria pessoa e a
  // conta Ghost, que não deve poder ser desafiada nem desafiar ninguém.
  useEffect(() => {
    fetch("/api/users/search", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]));
  }, []);

  const onlinePlayers = users.filter((u) => !!onlineMap[u.id]);

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()} style={{ width: 320 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>🎮 Jogos</h3>
          <button onClick={onClose} style={{ fontSize: 12, padding: "2px 8px" }} title="Fechar">
            ✕
          </button>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            background: "var(--surface-hover)",
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 22 }}>⭕</span>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>Jogo da velha</p>
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-faint)" }}>Em tempo real, com quem estiver online</p>
          </div>
        </div>

        {outgoingChallenge ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Esperando <strong>{outgoingChallenge.toUsername}</strong> aceitar...
            </p>
            <button onClick={cancelChallenge} style={{ fontSize: 12 }}>
              Cancelar desafio
            </button>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 13, fontWeight: 500, margin: "0 0 8px" }}>Quem está online ({onlinePlayers.length})</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 320, overflowY: "auto" }}>
              {onlinePlayers.length === 0 && (
                <p style={{ fontSize: 13, color: "var(--text-faint)" }}>Ninguém mais está online agora.</p>
              )}
              {onlinePlayers.map((p) => (
                <div
                  key={p.id}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 4px" }}
                >
                  <Avatar username={p.username} avatarColor={p.avatarColor} avatarUrl={p.avatarUrl} size={32} isOnline />
                  <span style={{ flex: 1, fontSize: 14, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.username}
                  </span>
                  <button onClick={() => sendChallenge(p)} style={{ fontSize: 12 }}>
                    Desafiar
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
