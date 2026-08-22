"use client";

import { useState } from "react";

const COLOR_HEX = { red: "#d94848", yellow: "#e0b93a", green: "#3fa15c", blue: "#3a7fd9" };
const COLOR_LABEL = { red: "Vermelho", yellow: "Amarelo", green: "Verde", blue: "Azul" };
const VALUE_LABEL = { skip: "🚫", reverse: "🔁", draw2: "+2", wild: "★", wild4: "+4" };

function Card({ card, onClick, disabled, small }) {
  const color = card.color ? COLOR_HEX[card.color] : "#26262c";
  const label = VALUE_LABEL[card.value] || card.value;
  const width = small ? 38 : 50;
  const height = small ? 56 : 72;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="playing-card"
      style={{
        width,
        height,
        position: "relative",
        background: `linear-gradient(155deg, ${color} 0%, ${color} 55%, rgba(0,0,0,0.22) 100%)`,
        color: "white",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <span
        style={{
          position: "absolute",
          inset: "12%",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.18)",
          transform: "rotate(-18deg)",
        }}
      />
      <span
        style={{
          position: "absolute",
          top: 4,
          left: 6,
          fontSize: small ? 9 : 11,
          fontWeight: 700,
          textShadow: "0 1px 2px rgba(0,0,0,0.4)",
        }}
      >
        {label}
      </span>
      <span style={{ position: "relative", fontSize: small ? 15 : 20, fontWeight: 800, textShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>
        {label}
      </span>
    </button>
  );
}

export default function UnoBoard({ game, onMove }) {
  const [pendingWildIndex, setPendingWildIndex] = useState(null);
  const canPlay = game.status === "playing" && game.turn === game.mySymbol;
  const opponentSymbol = game.mySymbol === "X" ? "O" : "X";
  const myHand = game.hands[game.mySymbol];
  const opponentCount = game.hands[opponentSymbol].length;
  const topCard = game.discard[game.discard.length - 1];

  function handlePlay(index) {
    if (!canPlay) return;
    const card = myHand[index];
    if (card.color === null) {
      setPendingWildIndex(index);
      return;
    }
    onMove({ action: "play", cardIndex: index });
  }

  function chooseColor(color) {
    onMove({ action: "play", cardIndex: pendingWildIndex, chosenColor: color });
    setPendingWildIndex(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {Array.from({ length: Math.min(opponentCount, 8) }).map((_, i) => (
          <div
            key={i}
            className="playing-card-back"
            style={{ width: 16, height: 24, marginLeft: i === 0 ? 0 : -10 }}
          />
        ))}
        <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 6 }}>
          {opponentCount} carta{opponentCount === 1 ? "" : "s"}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <button
          onClick={() => canPlay && onMove({ action: "draw" })}
          disabled={!canPlay}
          title="Comprar carta"
          className="playing-card-back"
          style={{ width: 50, height: 72, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, cursor: canPlay ? "pointer" : "default" }}
        >
          🂠
        </button>

        <div style={{ position: "relative" }}>
          <Card card={topCard} disabled />
          <div
            title="Cor atual"
            style={{
              position: "absolute",
              bottom: -6,
              right: -6,
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: COLOR_HEX[game.currentColor] || "#888",
              border: "2px solid var(--surface)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
            }}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", maxWidth: 270 }}>
        {myHand.map((card, i) => (
          <Card key={i} card={card} onClick={() => handlePlay(i)} disabled={!canPlay} small />
        ))}
      </div>

      {pendingWildIndex !== null && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 95,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div className="game-modal" style={{ width: "auto", padding: 20 }}>
            <p style={{ margin: "0 0 12px", fontSize: 14 }}>Escolha uma cor</p>
            <div style={{ display: "flex", gap: 10 }}>
              {Object.keys(COLOR_HEX).map((color) => (
                <button
                  key={color}
                  onClick={() => chooseColor(color)}
                  title={COLOR_LABEL[color]}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: "50%",
                    background: COLOR_HEX[color],
                    border: "2px solid rgba(255,255,255,0.5)",
                    boxShadow: "0 3px 8px rgba(0,0,0,0.3)",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
