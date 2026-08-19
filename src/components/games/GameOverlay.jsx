"use client";

import { useGame } from "@/context/GameContext.jsx";
import Avatar from "@/components/common/Avatar.jsx";

// Fica montado o tempo todo (igual à chamada de voz) - um desafio pode
// chegar de qualquer lugar do site, não só com o painel de jogos aberto.
export default function GameOverlay() {
  const { incomingChallenge, acceptChallenge, declineChallenge, activeGame, makeMove, rematch, leaveGame } = useGame();

  return (
    <>
      {incomingChallenge && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 90,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              color: "var(--text)",
              borderRadius: 16,
              padding: 28,
              width: 300,
              maxWidth: "85vw",
              textAlign: "center",
            }}
          >
            <Avatar
              username={incomingChallenge.fromUsername}
              avatarColor={incomingChallenge.fromAvatarColor}
              avatarUrl={incomingChallenge.fromAvatarUrl}
              size={56}
            />
            <p style={{ margin: "12px 0 4px", fontSize: 15, fontWeight: 500 }}>{incomingChallenge.fromUsername}</p>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--text-muted)" }}>te desafiou pro jogo da velha ⭕</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={declineChallenge}>Recusar</button>
              <button onClick={acceptChallenge} className="primary">
                Aceitar
              </button>
            </div>
          </div>
        </div>
      )}

      {activeGame && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 90,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              color: "var(--text)",
              borderRadius: 16,
              padding: 24,
              width: 320,
              maxWidth: "92vw",
              textAlign: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 4 }}>
              <Avatar username={activeGame.opponentUsername} avatarColor={activeGame.opponentAvatarColor} avatarUrl={activeGame.opponentAvatarUrl} size={30} />
              <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>
                Você ({activeGame.mySymbol}) vs {activeGame.opponentUsername} ({activeGame.mySymbol === "X" ? "O" : "X"})
              </p>
            </div>

            <p style={{ fontSize: 13, color: "var(--text-muted)", minHeight: 18, margin: "4px 0 16px" }}>
              {activeGame.status === "playing"
                ? activeGame.turn === activeGame.mySymbol
                  ? "Sua vez"
                  : `Vez de ${activeGame.opponentUsername}`
                : activeGame.status === "opponent-left"
                ? `${activeGame.opponentUsername} saiu do jogo.`
                : activeGame.resultMessage}
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 6,
                width: 220,
                margin: "0 auto 20px",
              }}
            >
              {activeGame.board.map((cell, i) => (
                <button
                  key={i}
                  onClick={() => makeMove(i)}
                  disabled={!!cell || activeGame.status !== "playing" || activeGame.turn !== activeGame.mySymbol}
                  style={{
                    width: "100%",
                    aspectRatio: "1 / 1",
                    fontSize: 30,
                    fontWeight: 700,
                    borderRadius: 8,
                    background: activeGame.winLine?.includes(i) ? "var(--success)" : "var(--surface-hover)",
                    color: activeGame.winLine?.includes(i) ? "white" : cell === "X" ? "var(--group-avatar-fg)" : "var(--danger)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {cell}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              {activeGame.status === "ended" && (
                <button onClick={rematch} className="primary">
                  Jogar de novo
                </button>
              )}
              <button onClick={leaveGame} style={activeGame.status === "playing" ? { color: "var(--danger)" } : undefined}>
                {activeGame.status === "playing" ? "Desistir" : "Sair"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
