function XMark() {
  return (
    <svg className="mark-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round">
      <path d="M5 5l14 14M19 5L5 19" />
    </svg>
  );
}

function OMark() {
  return (
    <svg className="mark-o" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2">
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}

export default function TicTacToeBoard({ game, onMove }) {
  const canPlay = game.status === "playing" && game.turn === game.mySymbol;
  const size = game.size || 3;
  const big = size > 3;

  // No modo "infinito", mostra com opacidade reduzida a peça mais antiga de
  // cada jogador que já tem as 3 em campo - é ela que some se essa pessoa
  // jogar de novo.
  const fading = new Set();
  if (game.mode === "vanishing" && game.marks) {
    for (const symbol of ["X", "O"]) {
      if (game.marks[symbol]?.length >= 3) fading.add(game.marks[symbol][0]);
    }
  }

  return (
    <div
      className="ttt-board"
      style={{ gridTemplateColumns: `repeat(${size}, 1fr)`, width: big ? 260 : 216 }}
    >
      {game.board.map((cell, i) => (
        <button
          key={i}
          onClick={() => onMove({ index: i })}
          disabled={!!cell || !canPlay}
          className={`ttt-cell${game.winLine?.includes(i) ? " win" : ""}${fading.has(i) ? " fading" : ""}`}
          style={big ? { padding: 6 } : undefined}
        >
          {cell === "X" && <XMark />}
          {cell === "O" && <OMark />}
        </button>
      ))}
    </div>
  );
}
