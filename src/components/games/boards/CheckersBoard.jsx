"use client";

import { useState } from "react";

const SIZE = 8;

function idx(r, c) {
  return r * SIZE + c;
}

export default function CheckersBoard({ game, onMove }) {
  const [selected, setSelected] = useState(null);
  const canPlay = game.status === "playing" && game.turn === game.mySymbol;
  // Cada um vê suas próprias peças embaixo - se eu for "O", giro o tabuleiro.
  const flipped = game.mySymbol === "O";

  function toBoardIndex(displayRow, displayCol) {
    const r = flipped ? SIZE - 1 - displayRow : displayRow;
    const c = flipped ? SIZE - 1 - displayCol : displayCol;
    return idx(r, c);
  }

  function handleClick(boardIndex) {
    if (!canPlay) return;
    const piece = game.board[boardIndex];

    if (selected === null) {
      if (piece?.symbol === game.mySymbol) setSelected(boardIndex);
      return;
    }

    if (boardIndex === selected) {
      setSelected(null);
      return;
    }

    if (piece?.symbol === game.mySymbol) {
      setSelected(boardIndex);
      return;
    }

    onMove({ from: selected, to: boardIndex });
    setSelected(null);
  }

  const cells = [];
  for (let displayRow = 0; displayRow < SIZE; displayRow++) {
    for (let displayCol = 0; displayCol < SIZE; displayCol++) {
      const boardIndex = toBoardIndex(displayRow, displayCol);
      const dark = (displayRow + displayCol) % 2 === 1;
      const piece = game.board[boardIndex];
      const isSelected = selected === boardIndex;

      cells.push(
        <button
          key={boardIndex}
          onClick={() => handleClick(boardIndex)}
          disabled={!dark}
          style={{
            width: "100%",
            aspectRatio: "1 / 1",
            border: isSelected ? "2px solid var(--success)" : "none",
            background: dark ? "#3a2c22" : "#e9dcc9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            cursor: dark && piece?.symbol === game.mySymbol ? "pointer" : dark ? "default" : "default",
          }}
        >
          {piece && (
            <div
              style={{
                width: "76%",
                height: "76%",
                borderRadius: "50%",
                background: piece.symbol === "X" ? "#d94848" : "#f2f2f2",
                border: "2px solid rgba(0,0,0,0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                color: piece.symbol === "X" ? "#fff" : "#333",
                fontWeight: 700,
              }}
            >
              {piece.king ? "♛" : ""}
            </div>
          )}
        </button>
      );
    }
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(8, 1fr)",
        width: 264,
        margin: "0 auto",
        border: "2px solid var(--border)",
        borderRadius: 6,
        overflow: "hidden",
      }}
    >
      {cells}
    </div>
  );
}
