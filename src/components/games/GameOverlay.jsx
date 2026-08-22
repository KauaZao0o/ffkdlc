"use client";

import { useEffect, useRef } from "react";
import { useGame } from "@/context/GameContext.jsx";
import { useSound } from "@/context/SoundContext.jsx";
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

const DIFFICULTY_LABEL = { easy: "Fácil", medium: "Médio", hard: "Difícil" };

// Fica montado o tempo todo (igual à chamada de voz) - um desafio pode
// chegar de qualquer lugar do site, não só com o painel de jogos aberto.
export default function GameOverlay() {
  const { incomingChallenge, acceptChallenge, declineChallenge, activeGame, makeMove, rematch, leaveGame } = useGame();
  const { playBattle } = useSound();

  // Toca a fanfarra de desafio assim que um desafio chega (o lado que
  // manda já ouve na hora que clica em "Desafiar", no GamesDrawer).
  const lastChallengeIdRef = useRef(null);
  useEffect(() => {
    if (incomingChallenge && incomingChallenge.gameId !== lastChallengeIdRef.current) {
      lastChallengeIdRef.current = incomingChallenge.gameId;
      playBattle();
    }
    if (!incomingChallenge) lastChallengeIdRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingChallenge]);

  const Board = activeGame ? BOARDS[activeGame.gameType] : null;
  const opponentSymbol = activeGame && (activeGame.mySymbol === "X" ? "O" : "X");

  let statusText = "";
  let statusClass = "game-status";
  if (activeGame) {
    if (activeGame.status === "connecting") {
      statusText = "Preparando o jogo...";
    } else if (activeGame.status === "playing") {
      const myTurn = activeGame.turn === activeGame.mySymbol;
      statusText = myTurn ? "Sua vez" : `Vez de ${activeGame.opponentUsername}`;
      if (myTurn) statusClass += " my-turn";
    } else if (activeGame.status === "opponent-left") {
      statusText = `${activeGame.opponentUsername} saiu do jogo.`;
    } else {
      statusText = activeGame.resultMessage;
      if (activeGame.resultMessage?.includes("venceu")) statusClass += " result-won";
      else if (activeGame.resultMessage?.includes("perdeu")) statusClass += " result-lost";
    }
  }

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
          <div className="game-modal" style={{ width: 300 }}>
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
            <div className="game-actions">
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
          <div className="game-modal">
            <div className="game-vs-row">
              <Avatar username={activeGame.opponentUsername} avatarColor={activeGame.opponentAvatarColor} avatarUrl={activeGame.opponentAvatarUrl} size={30} />
              <p className="game-vs-name" style={{ margin: 0 }}>
                Você vs {activeGame.opponentUsername}
                {activeGame.vsBot && <span className="game-difficulty-tag"> ({DIFFICULTY_LABEL[activeGame.difficulty] || "Médio"})</span>}
              </p>
            </div>

            {activeGame.matchScore && (activeGame.matchScore.X > 0 || activeGame.matchScore.O > 0) && (
              <p className="game-score">
                Placar: você {activeGame.matchScore[activeGame.mySymbol]} · {activeGame.opponentUsername} {activeGame.matchScore[opponentSymbol]}
              </p>
            )}

            <p className={statusClass}>{statusText}</p>

            <div style={{ margin: "0 0 20px" }}>
              {activeGame.status === "connecting" || !Board ? (
                <p style={{ fontSize: 24 }}>⏳</p>
              ) : (
                <Board game={activeGame} onMove={makeMove} />
              )}
            </div>

            <div className="game-actions">
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
