"use client";

import { useEffect, useState } from "react";

const SUIT_SYMBOL = { diamonds: "♦", spades: "♠", hearts: "♥", clubs: "♣" };
const SUIT_COLOR = { diamonds: "#c0392b", hearts: "#c0392b", spades: "#1c1c1a", clubs: "#1c1c1a" };
const REVEAL_MS = 2200;

function Card({ card, onClick, disabled, faceDown, isManilha, small, won }) {
  const width = small ? 40 : 48;
  const height = small ? 58 : 70;

  if (faceDown) {
    return <div className="playing-card-back" style={{ width, height }} />;
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="playing-card"
      style={{
        width,
        height,
        position: "relative",
        background: "#fff",
        color: SUIT_COLOR[card.suit],
        boxShadow: won
          ? "0 0 0 2px var(--success), 0 4px 14px rgba(79,168,79,0.55)"
          : isManilha
          ? "0 0 0 2px var(--success), 0 4px 12px rgba(79,168,79,0.45)"
          : "0 3px 8px rgba(0,0,0,0.3)",
        opacity: disabled && !isManilha && !won ? 0.75 : 1,
      }}
    >
      <span style={{ position: "absolute", top: 3, left: 5, fontSize: small ? 10 : 12, fontWeight: 800, lineHeight: 1 }}>
        {card.rank}
        <br />
        {SUIT_SYMBOL[card.suit]}
      </span>
      <span style={{ fontSize: small ? 20 : 26 }}>{SUIT_SYMBOL[card.suit]}</span>
      {isManilha && (
        <span style={{ position: "absolute", bottom: 2, right: 4, fontSize: 9, fontWeight: 700, color: "var(--success)" }}>★</span>
      )}
    </button>
  );
}

export default function TrucoBoard({ game, onMove }) {
  const canPlay = game.status === "playing" && game.turn === game.mySymbol;
  const opponentSymbol = game.mySymbol === "X" ? "O" : "X";
  const myHand = game.hands[game.mySymbol];
  const opponentCount = game.hands[opponentSymbol].length;
  const myTablePlay = game.table.find((p) => p.symbol === game.mySymbol);
  const opponentTablePlay = game.table.find((p) => p.symbol === opponentSymbol);

  // A rodada some da mesa assim que os dois jogam (o estado já avança pra
  // próxima), então sem isso a pessoa não tinha tempo de ver a carta que o
  // bot/adversário jogou. Segura as duas cartas visíveis por alguns
  // segundos depois de cada rodada resolvida.
  const [revealedRound, setRevealedRound] = useState(null);
  useEffect(() => {
    if (!game.lastRound) return;
    setRevealedRound(game.lastRound);
    const timer = setTimeout(() => setRevealedRound(null), REVEAL_MS);
    return () => clearTimeout(timer);
  }, [game.lastRound]);

  // A revelação da última rodada tem prioridade sobre uma jogada nova que
  // já esteja em andamento - se não, quando o bot vence e já lidera a
  // próxima rodada rapidinho, a pessoa nunca chega a ver o que ele jogou.
  const showReveal = !!revealedRound;
  const revealFor = (symbol) => revealedRound && [revealedRound.a, revealedRound.b].find((p) => p.symbol === symbol);

  const myPlay = showReveal ? revealFor(game.mySymbol) : myTablePlay;
  const opponentPlay = showReveal ? revealFor(opponentSymbol) : opponentTablePlay;
  const roundWinner = showReveal ? revealedRound.winner : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, fontSize: 12 }}>
        <span style={{ color: "var(--text-muted)" }}>
          Você <strong style={{ color: "var(--text)" }}>{game.roundsWon[game.mySymbol]}</strong>
        </span>
        <span style={{ color: "var(--text-faint)" }}>·</span>
        <span style={{ color: "var(--text-muted)" }}>
          Oponente <strong style={{ color: "var(--text)" }}>{game.roundsWon[opponentSymbol]}</strong>
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {Array.from({ length: opponentCount }).map((_, i) => (
          <Card key={i} faceDown small />
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: "0 0 4px", fontSize: 11, color: "var(--text-faint)" }}>Vira</p>
          <Card card={game.vira} disabled small />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, color: "var(--text-faint)" }}>Oponente</p>
            {opponentPlay ? (
              <Card card={opponentPlay.card} disabled isManilha={opponentPlay.card.rank === game.manilha} won={roundWinner === opponentSymbol} />
            ) : (
              <Card faceDown />
            )}
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, color: "var(--text-faint)" }}>Você</p>
            {myPlay ? (
              <Card card={myPlay.card} disabled isManilha={myPlay.card.rank === game.manilha} won={roundWinner === game.mySymbol} />
            ) : (
              <Card faceDown />
            )}
          </div>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 12, minHeight: 16, color: "var(--success)", fontWeight: 600 }}>
        {showReveal ? (roundWinner === null ? "Rodada empatada" : roundWinner === game.mySymbol ? "Você venceu a rodada" : "Oponente venceu a rodada") : ""}
      </p>

      <div style={{ display: "flex", gap: 10 }}>
        {myHand.map((card, i) => (
          <Card
            key={i}
            card={card}
            isManilha={card.rank === game.manilha}
            disabled={!canPlay || !!myTablePlay}
            onClick={() => onMove({ cardIndex: i })}
          />
        ))}
      </div>
    </div>
  );
}
