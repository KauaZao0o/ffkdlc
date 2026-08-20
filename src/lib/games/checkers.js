export const id = "checkers";
export const label = "🔴 Dama";

const SIZE = 8;

function idx(r, c) {
  return r * SIZE + c;
}

// Versão simplificada das regras de dama: peça normal só anda/captura na
// diagonal (1 casa pra andar, 2 casas pra capturar pulando a peça
// adversária); captura não é obrigatória; só uma captura por jogada (sem
// "correr" capturando várias peças na mesma jogada); dama (peça promovida)
// anda/captura em qualquer direção diagonal, mas só 1 casa por vez. Vence
// quem tirar todas as peças do adversário.
export function createInitialState() {
  const board = Array(64).fill(null);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < SIZE; c++) {
      if ((r + c) % 2 === 1) board[idx(r, c)] = { symbol: "O", king: false };
    }
  }
  for (let r = 5; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if ((r + c) % 2 === 1) board[idx(r, c)] = { symbol: "X", king: false };
    }
  }
  return { board };
}

// move = { from, to } (índices 0-63)
export function applyMove(state, move, symbol) {
  const { from, to } = move;
  const board = state.board;
  const piece = board[from];
  if (!piece || piece.symbol !== symbol) return null;
  if (to < 0 || to >= 64 || board[to]) return null;

  const rFrom = Math.floor(from / SIZE);
  const cFrom = from % SIZE;
  const rTo = Math.floor(to / SIZE);
  const cTo = to % SIZE;
  const dr = rTo - rFrom;
  const dc = cTo - cFrom;

  const next = board.slice();

  if (Math.abs(dr) === 1 && Math.abs(dc) === 1) {
    if (!piece.king) {
      const forward = piece.symbol === "X" ? -1 : 1;
      if (dr !== forward) return null;
    }
  } else if (Math.abs(dr) === 2 && Math.abs(dc) === 2) {
    const midR = rFrom + dr / 2;
    const midC = cFrom + dc / 2;
    const midPiece = board[idx(midR, midC)];
    if (!midPiece || midPiece.symbol === symbol) return null;
    next[idx(midR, midC)] = null;
  } else {
    return null;
  }

  next[from] = null;
  const becomesKing = piece.king || (piece.symbol === "X" && rTo === 0) || (piece.symbol === "O" && rTo === SIZE - 1);
  next[to] = { symbol: piece.symbol, king: becomesKing };

  return { board: next, turn: symbol === "X" ? "O" : "X" };
}

export function checkResult(state) {
  const hasX = state.board.some((p) => p?.symbol === "X");
  const hasO = state.board.some((p) => p?.symbol === "O");
  if (!hasX) return { winner: "O" };
  if (!hasO) return { winner: "X" };
  return null;
}
