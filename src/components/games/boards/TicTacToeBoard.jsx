export default function TicTacToeBoard({ game, onMove }) {
  const canPlay = game.status === "playing" && game.turn === game.mySymbol;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 6,
        width: 220,
        margin: "0 auto",
      }}
    >
      {game.board.map((cell, i) => (
        <button
          key={i}
          onClick={() => onMove({ index: i })}
          disabled={!!cell || !canPlay}
          style={{
            width: "100%",
            aspectRatio: "1 / 1",
            fontSize: 30,
            fontWeight: 700,
            borderRadius: 8,
            background: game.winLine?.includes(i) ? "var(--success)" : "var(--surface-hover)",
            color: game.winLine?.includes(i) ? "white" : cell === "X" ? "var(--group-avatar-fg)" : "var(--danger)",
            border: "1px solid var(--border)",
          }}
        >
          {cell}
        </button>
      ))}
    </div>
  );
}
