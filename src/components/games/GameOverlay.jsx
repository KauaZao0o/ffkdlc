"use client";

import { useGame } from "@/context/GameContext.jsx";
import { GAMES } from "@/lib/games";
import Avatar from "@/components/common/Avatar.jsx";
import TicTacToeBoard from "./boards/TicTacToeBoard.jsx";
import CheckersBoard from "./boards/CheckersBoard.jsx";
import UnoBoard from "./boards/UnoBoard.jsx";
import TrucoBoard from "./boards/TrucoBoard.jsx";

const BOARDS = {
  tictactoe: TicTacToeBoard,
  checkers: CheckersBoard,
  uno: UnoBoard,
  truco: TrucoBoard,
};

// Fica montado o tempo todo (igual à chamada de voz) - um desafio pode
// chegar de qualquer lugar do site, não só com o painel de jogos aberto.
export default function GameOverlay() {
  const { incomingChallenge, acceptChallenge, declineChallenge, activeGame, makeMove, rematch, leaveGame } = useGame();

  const Board = activeGame ? BOARDS[activeGame.gameType] : null;
  const opponentSymbol = activeGame && (activeGame.mySymbol === "X" ? "O" : "X");

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
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--text-muted)" }}>
              te desafiou pro {GAMES[incomingChallenge.gameType]?.label || "jogo"}
            </p>
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
            overflowY: "auto",
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              color: "var(--text)",
              borderRadius: 16,
              padding: 24,
              width: 340,
              maxWidth: "94vw",
              textAlign: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 4 }}>
              <Avatar username={activeGame.opponentUsername} avatarColor={activeGame.opponentAvatarColor} avatarUrl={activeGame.opponentAvatarUrl} size={30} />
              <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>
                Você vs {activeGame.opponentUsername}
              </p>
            </div>

            {activeGame.matchScore && (activeGame.matchScore.X > 0 || activeGame.matchScore.O > 0) && (
              <p style={{ margin: "0 0 4px", fontSize: 12, color: "var(--text-faint)" }}>
                Placar: você {activeGame.matchScore[activeGame.mySymbol]} · {activeGame.opponentUsername} {activeGame.matchScore[opponentSymbol]}
              </p>
            )}

            <p style={{ fontSize: 13, color: "var(--text-muted)", minHeight: 18, margin: "4px 0 16px" }}>
              {activeGame.status === "connecting"
                ? "Preparando o jogo..."
                : activeGame.status === "playing"
                ? activeGame.turn === activeGame.mySymbol
                  ? "Sua vez"
                  : `Vez de ${activeGame.opponentUsername}`
                : activeGame.status === "opponent-left"
                ? `${activeGame.opponentUsername} saiu do jogo.`
                : activeGame.resultMessage}
            </p>

            <div style={{ margin: "0 0 20px" }}>
              {activeGame.status === "connecting" || !Board ? (
                <p style={{ fontSize: 24 }}>⏳</p>
              ) : (
                <Board game={activeGame} onMove={makeMove} />
              )}
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
