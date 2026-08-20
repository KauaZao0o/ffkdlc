const SUIT_SYMBOL = { diamonds: "♦", spades: "♠", hearts: "♥", clubs: "♣" };
const SUIT_COLOR = { diamonds: "#d94848", hearts: "#d94848", spades: "#1c1c1a", clubs: "#1c1c1a" };

function Card({ card, onClick, disabled, faceDown, isManilha }) {
  if (faceDown) {
    return (
      <div
        style={{
          width: 46,
          height: 66,
          borderRadius: 6,
          border: "2px solid rgba(255,255,255,0.4)",
          background: "repeating-linear-gradient(45deg, #2a3a5c, #2a3a5c 4px, #223054 4px, #223054 8px)",
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 46,
        height: 66,
        borderRadius: 6,
        border: isManilha ? "2px solid var(--success)" : "2px solid var(--border)",
        background: "#fff",
        color: SUIT_COLOR[card.suit],
        fontWeight: 700,
        fontSize: 14,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span>{card.rank}</span>
      <span style={{ fontSize: 16 }}>{SUIT_SYMBOL[card.suit]}</span>
    </button>
  );
}

export default function TrucoBoard({ game, onMove }) {
  const canPlay = game.status === "playing" && game.turn === game.mySymbol;
  const opponentSymbol = game.mySymbol === "X" ? "O" : "X";
  const myHand = game.hands[game.mySymbol];
  const opponentCount = game.hands[opponentSymbol].length;
  const myPlay = game.table.find((p) => p.symbol === game.mySymbol);
  const opponentPlay = game.table.find((p) => p.symbol === opponentSymbol);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
        Rodadas: você {game.roundsWon[game.mySymbol]} · oponente {game.roundsWon[opponentSymbol]}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {Array.from({ length: opponentCount }).map((_, i) => (
          <Card key={i} faceDown />
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: "0 0 4px", fontSize: 11, color: "var(--text-faint)" }}>Vira</p>
          <Card card={game.vira} disabled />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, color: "var(--text-faint)" }}>Oponente</p>
            {opponentPlay ? <Card card={opponentPlay.card} disabled isManilha={opponentPlay.card.rank === game.manilha} /> : <Card faceDown />}
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, color: "var(--text-faint)" }}>Você</p>
            {myPlay ? <Card card={myPlay.card} disabled isManilha={myPlay.card.rank === game.manilha} /> : <Card faceDown />}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        {myHand.map((card, i) => (
          <Card
            key={i}
            card={card}
            isManilha={card.rank === game.manilha}
            disabled={!canPlay || !!myPlay}
            onClick={() => onMove({ cardIndex: i })}
          />
        ))}
      </div>
    </div>
  );
}
