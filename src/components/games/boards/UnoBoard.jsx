"use client";

import { useState } from "react";

const COLOR_HEX = { red: "#d94848", yellow: "#e0b93a", green: "#3fa15c", blue: "#3a7fd9" };
const COLOR_LABEL = { red: "Vermelho", yellow: "Amarelo", green: "Verde", blue: "Azul" };
const VALUE_LABEL = { skip: "🚫", reverse: "🔁", draw2: "+2", wild: "★", wild4: "+4★" };

function Card({ card, onClick, disabled, small }) {
  const bg = card.color ? COLOR_HEX[card.color] : "#2a2a2a";
  const label = VALUE_LABEL[card.value] || card.value;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: small ? 34 : 46,
        height: small ? 50 : 66,
        borderRadius: 6,
        border: "2px solid rgba(255,255,255,0.5)",
        background: bg,
        color: "white",
        fontWeight: 700,
        fontSize: small ? 13 : 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Oponente: {opponentCount} carta{opponentCount === 1 ? "" : "s"}</div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <button
          onClick={() => canPlay && onMove({ action: "draw" })}
          disabled={!canPlay}
          title="Comprar carta"
          style={{
            width: 46,
            height: 66,
            borderRadius: 6,
            border: "2px dashed var(--border)",
            background: "var(--surface-hover)",
            fontSize: 20,
          }}
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
            }}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", maxWidth: 260 }}>
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
          <div style={{ background: "var(--surface)", borderRadius: 12, padding: 20, textAlign: "center" }}>
            <p style={{ margin: "0 0 12px", fontSize: 14 }}>Escolha uma cor</p>
            <div style={{ display: "flex", gap: 8 }}>
              {Object.keys(COLOR_HEX).map((color) => (
                <button
                  key={color}
                  onClick={() => chooseColor(color)}
                  title={COLOR_LABEL[color]}
                  style={{ width: 40, height: 40, borderRadius: "50%", background: COLOR_HEX[color], border: "2px solid rgba(255,255,255,0.5)" }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
