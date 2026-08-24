"use client";

import { useEffect, useMemo, useState } from "react";
import { getLegalMoves, isInCheck } from "@/lib/games/chess.js";

const SIZE = 8;

const PIECE_GLYPH = {
  X: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  O: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
};

const PROMOTION_CHOICES = [
  { id: "q", label: "♕ Dama" },
  { id: "r", label: "♖ Torre" },
  { id: "b", label: "♗ Bispo" },
  { id: "n", label: "♘ Cavalo" },
];

function idx(r, c) {
  return r * SIZE + c;
}

export default function ChessBoard({ game, onMove }) {
  const [selected, setSelected] = useState(null);
  const [pendingPromotion, setPendingPromotion] = useState(null);
  const canPlay = game.status === "playing" && game.turn === game.mySymbol;
  // Cada um vê suas próprias peças embaixo - se eu for "O", giro o tabuleiro.
  const flipped = game.mySymbol === "O";

  useEffect(() => {
    setSelected(null);
    setPendingPromotion(null);
  }, [game.gameId, game.status]);

  const legalMoves = useMemo(() => {
    if (selected === null || !canPlay) return [];
    return getLegalMoves(game, game.mySymbol).filter((m) => m.from === selected);
  }, [game, canPlay, selected]);

  const destinations = useMemo(() => new Map(legalMoves.map((m) => [m.to, m])), [legalMoves]);

  const inCheckColor = useMemo(() => {
    if (isInCheck(game, "X")) return "X";
    if (isInCheck(game, "O")) return "O";
    return null;
  }, [game]);

  function toBoardIndex(displayRow, displayCol) {
    const r = flipped ? SIZE - 1 - displayRow : displayRow;
    const c = flipped ? SIZE - 1 - displayCol : displayCol;
    return idx(r, c);
  }

  function handleClick(boardIndex) {
    if (!canPlay || pendingPromotion) return;
    const piece = game.board[boardIndex];

    if (selected === null) {
      if (piece?.color === game.mySymbol) setSelected(boardIndex);
      return;
    }

    if (boardIndex === selected) {
      setSelected(null);
      return;
    }

    const match = destinations.get(boardIndex);
    if (!match) {
      if (piece?.color === game.mySymbol) setSelected(boardIndex);
      else setSelected(null);
      return;
    }

    if (match.promotion) {
      setPendingPromotion({ from: selected, to: boardIndex });
      setSelected(null);
      return;
    }

    onMove({ from: selected, to: boardIndex });
    setSelected(null);
  }

  function choosePromotion(promotion) {
    if (!pendingPromotion) return;
    onMove({ from: pendingPromotion.from, to: pendingPromotion.to, promotion });
    setPendingPromotion(null);
  }

  const cells = [];
  for (let displayRow = 0; displayRow < SIZE; displayRow++) {
    for (let displayCol = 0; displayCol < SIZE; displayCol++) {
      const boardIndex = toBoardIndex(displayRow, displayCol);
      const dark = (displayRow + displayCol) % 2 === 1;
      const piece = game.board[boardIndex];
      const isSelected = selected === boardIndex;
      const dest = destinations.get(boardIndex);
      const isCheckedKing = piece?.type === "k" && piece.color === inCheckColor;

      const classNames = ["chess-cell", dark ? "dark" : "light"];
      if (isSelected) classNames.push("selected");
      if (dest) classNames.push(dest.capture || game.board[boardIndex] ? "hint-capture" : "hint");
      if (isCheckedKing) classNames.push("in-check");

      cells.push(
        <button key={boardIndex} onClick={() => handleClick(boardIndex)} className={classNames.join(" ")}>
          {piece && <span className={`chess-piece color-${piece.color.toLowerCase()}`}>{PIECE_GLYPH[piece.color][piece.type]}</span>}
        </button>
      );
    }
  }

  return (
    <div>
      {inCheckColor && !pendingPromotion && (
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--danger)" }}>
          {inCheckColor === game.mySymbol ? "Seu rei está em xeque!" : "O rei do oponente está em xeque!"}
        </p>
      )}
      <div className="chess-board">{cells}</div>

      {pendingPromotion && (
        <div style={{ marginTop: 10, display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
          {PROMOTION_CHOICES.map((c) => (
            <button key={c.id} onClick={() => choosePromotion(c.id)} style={{ fontSize: 13 }}>
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
