"use client";

import { useEffect, useMemo, useState } from "react";
import { getLegalMoves } from "@/lib/games/checkers.js";

const SIZE = 8;

function idx(r, c) {
  return r * SIZE + c;
}

export default function CheckersBoard({ game, onMove }) {
  const [selected, setSelected] = useState(null);
  const canPlay = game.status === "playing" && game.turn === game.mySymbol;
  // Cada um vê suas próprias peças embaixo - se eu for "O", giro o tabuleiro.
  const flipped = game.mySymbol === "O";
  // Regra de sequência de capturas: se a mesma peça ainda pode capturar de
  // novo, o jogo trava a seleção nela - não dá pra trocar de peça no meio.
  const forcedFrom = canPlay ? game.mustContinueFrom : null;
  const activeFrom = forcedFrom ?? selected;

  useEffect(() => {
    if (forcedFrom !== null && forcedFrom !== undefined) setSelected(forcedFrom);
  }, [forcedFrom]);

  // Mostra pra onde a peça selecionada pode ir - já respeita captura
  // obrigatória (se tiver captura em qualquer peça, só ela aparece como
  // destino válido aqui).
  const hints = useMemo(() => {
    if (activeFrom === null || activeFrom === undefined || !canPlay) return new Map();
    const moves = getLegalMoves(game, game.mySymbol).filter((m) => m.from === activeFrom);
    return new Map(moves.map((m) => [m.to, m.capture]));
  }, [game, canPlay, activeFrom]);

  function toBoardIndex(displayRow, displayCol) {
    const r = flipped ? SIZE - 1 - displayRow : displayRow;
    const c = flipped ? SIZE - 1 - displayCol : displayCol;
    return idx(r, c);
  }

  function handleClick(boardIndex) {
    if (!canPlay) return;

    if (forcedFrom !== null && forcedFrom !== undefined) {
      if (boardIndex === forcedFrom) return;
      onMove({ from: forcedFrom, to: boardIndex });
      return;
    }

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
      const isSelected = activeFrom === boardIndex;
      const isCaptureHint = hints.get(boardIndex);
      const isHint = hints.has(boardIndex);

      const classNames = ["checkers-cell", dark ? "dark" : "light"];
      if (isSelected) classNames.push("selected");
      if (isHint) classNames.push(isCaptureHint ? "hint-capture" : "hint");

      cells.push(
        <button key={boardIndex} onClick={() => handleClick(boardIndex)} disabled={!dark} className={classNames.join(" ")}>
          {piece && (
            <div className={`checkers-piece symbol-${piece.symbol.toLowerCase()}`}>{piece.king ? "♛" : ""}</div>
          )}
        </button>
      );
    }
  }

  return (
    <div>
      {forcedFrom !== null && forcedFrom !== undefined && (
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--success)" }}>Continue capturando com a mesma peça</p>
      )}
      <div className="checkers-board">{cells}</div>
    </div>
  );
}
