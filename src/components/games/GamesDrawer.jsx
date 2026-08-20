"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext.jsx";
import { usePresence } from "@/context/PresenceContext.jsx";
import { useGame } from "@/context/GameContext.jsx";
import { GAME_LIST } from "@/lib/games";
import Avatar from "@/components/common/Avatar.jsx";

const GAME_DESCRIPTIONS = {
  tictactoe: "Clássico 3x3, melhor de várias rodadas",
  checkers: "Dama simplificada, sem captura obrigatória",
  uno: "1 contra 1, mão de 7 cartas",
  truco: "1 contra 1, melhor de 3 rodadas por mão",
};

// Painel de jogos - escolhe o jogo primeiro, depois quem está online agora
// pra desafiar (só dá pra jogar com quem está conectado, já que o desafio é
// em tempo real).
export default function GamesDrawer({ onClose }) {
  const { user } = useAuth();
  const { onlineMap } = usePresence();
  const { outgoingChallenge, sendChallenge, cancelChallenge } = useGame();
  const [users, setUsers] = useState([]);
  const [selectedGame, setSelectedGame] = useState(GAME_LIST[0].id);

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

        {outgoingChallenge ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Esperando <strong>{outgoingChallenge.toUsername}</strong> aceitar o {GAME_LIST.find((g) => g.id === outgoingChallenge.gameType)?.label}...
            </p>
            <button onClick={cancelChallenge} style={{ fontSize: 12 }}>
              Cancelar desafio
            </button>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 13, fontWeight: 500, margin: "0 0 8px" }}>Escolha o jogo</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
              {GAME_LIST.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGame(g.id)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 2,
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: selectedGame === g.id ? "1px solid var(--group-avatar-fg)" : "1px solid var(--border)",
                    background: selectedGame === g.id ? "var(--surface-hover)" : "var(--surface)",
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{g.label}</span>
                  <span style={{ fontSize: 12, color: "var(--text-faint)" }}>{GAME_DESCRIPTIONS[g.id]}</span>
                </button>
              ))}
            </div>

            <p style={{ fontSize: 13, fontWeight: 500, margin: "0 0 8px" }}>Quem está online ({onlinePlayers.length})</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 240, overflowY: "auto" }}>
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
                  <button onClick={() => sendChallenge(p, selectedGame)} style={{ fontSize: 12 }}>
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
