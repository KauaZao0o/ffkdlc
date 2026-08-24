export const id = "chess";
export const label = "♟️ Xadrez";

const SIZE = 8;
const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

const KNIGHT_OFFSETS = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1],
];
const KING_OFFSETS = [
  [-1, -1], [-1, 0], [-1, 1], [0, -1],
  [0, 1], [1, -1], [1, 0], [1, 1],
];
const ROOK_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const BISHOP_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const QUEEN_DIRS = [...ROOK_DIRS, ...BISHOP_DIRS];

function idx(r, c) {
  return r * SIZE + c;
}
function inBounds(r, c) {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}
function opponent(color) {
  return color === "X" ? "O" : "X";
}
// X (quem desafiou) joga de baixo pra cima do tabuleiro (como as brancas);
// O joga o caminho inverso.
function forwardDir(color) {
  return color === "X" ? -1 : 1;
}
function startRow(color) {
  return color === "X" ? 6 : 1;
}
function promotionRow(color) {
  return color === "X" ? 0 : 7;
}

const BACK_RANK_TYPES = ["r", "n", "b", "q", "k", "b", "n", "r"];

function buildInitialBoard() {
  const board = Array(64).fill(null);
  for (let c = 0; c < SIZE; c++) {
    board[idx(7, c)] = { type: BACK_RANK_TYPES[c], color: "X" };
    board[idx(6, c)] = { type: "p", color: "X" };
    board[idx(1, c)] = { type: "p", color: "O" };
    board[idx(0, c)] = { type: BACK_RANK_TYPES[c], color: "O" };
  }
  return board;
}

export function createInitialState() {
  return {
    board: buildInitialBoard(),
    castling: { X: { kingSide: true, queenSide: true }, O: { kingSide: true, queenSide: true } },
    enPassantTarget: null,
    lastMove: null,
  };
}

function findKing(board, color) {
  for (let i = 0; i < 64; i++) {
    if (board[i]?.type === "k" && board[i].color === color) return i;
  }
  return -1;
}

// Olha se `square` está sob ataque de alguma peça de `byColor`, "de trás
// pra frente": a partir do quadrado, procura em cada direção/padrão se
// encontra uma peça inimiga que bateria ali - evita ter que gerar todos os
// movimentos de todo mundo só pra checar uma casa.
function isSquareAttacked(board, square, byColor) {
  const r = Math.floor(square / SIZE);
  const c = square % SIZE;

  const dir = forwardDir(byColor);
  for (const dc of [-1, 1]) {
    const pr = r - dir;
    const pc = c - dc;
    if (inBounds(pr, pc)) {
      const p = board[idx(pr, pc)];
      if (p && p.type === "p" && p.color === byColor) return true;
    }
  }

  for (const [dr, dc] of KNIGHT_OFFSETS) {
    const nr = r + dr, nc = c + dc;
    if (!inBounds(nr, nc)) continue;
    const p = board[idx(nr, nc)];
    if (p && p.type === "n" && p.color === byColor) return true;
  }

  for (const [dr, dc] of KING_OFFSETS) {
    const nr = r + dr, nc = c + dc;
    if (!inBounds(nr, nc)) continue;
    const p = board[idx(nr, nc)];
    if (p && p.type === "k" && p.color === byColor) return true;
  }

  for (const [dr, dc] of ROOK_DIRS) {
    let nr = r + dr, nc = c + dc;
    while (inBounds(nr, nc)) {
      const p = board[idx(nr, nc)];
      if (p) {
        if (p.color === byColor && (p.type === "r" || p.type === "q")) return true;
        break;
      }
      nr += dr;
      nc += dc;
    }
  }

  for (const [dr, dc] of BISHOP_DIRS) {
    let nr = r + dr, nc = c + dc;
    while (inBounds(nr, nc)) {
      const p = board[idx(nr, nc)];
      if (p) {
        if (p.color === byColor && (p.type === "b" || p.type === "q")) return true;
        break;
      }
      nr += dr;
      nc += dc;
    }
  }

  return false;
}

function addPawnMove(moves, from, to, color) {
  if (Math.floor(to / SIZE) === promotionRow(color)) {
    for (const promotion of ["q", "r", "b", "n"]) moves.push({ from, to, promotion });
  } else {
    moves.push({ from, to });
  }
}

// Gera os movimentos "pseudo-legais" de uma peça (respeitando como cada
// peça anda e captura, incluindo roque/en passant) mas sem checar ainda se
// isso deixaria o próprio rei em xeque - isso é filtrado depois em
// getLegalMoves, testando cada candidato.
function pieceMovesPseudo(board, from, state) {
  const piece = board[from];
  if (!piece) return [];
  const { type, color } = piece;
  const r = Math.floor(from / SIZE);
  const c = from % SIZE;
  const moves = [];

  if (type === "p") {
    const dir = forwardDir(color);
    const oneR = r + dir;
    if (inBounds(oneR, c) && !board[idx(oneR, c)]) {
      addPawnMove(moves, from, idx(oneR, c), color);
      const twoR = r + dir * 2;
      if (r === startRow(color) && inBounds(twoR, c) && !board[idx(twoR, c)]) {
        moves.push({ from, to: idx(twoR, c), doubleStep: true });
      }
    }
    for (const dc of [-1, 1]) {
      const cr = r + dir, cc = c + dc;
      if (!inBounds(cr, cc)) continue;
      const target = idx(cr, cc);
      if (board[target] && board[target].color !== color) {
        addPawnMove(moves, from, target, color);
      } else if (target === state.enPassantTarget) {
        moves.push({ from, to: target, enPassant: true });
      }
    }
  } else if (type === "n") {
    for (const [dr, dc] of KNIGHT_OFFSETS) {
      const nr = r + dr, nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      const target = board[idx(nr, nc)];
      if (!target || target.color !== color) moves.push({ from, to: idx(nr, nc) });
    }
  } else if (type === "b" || type === "r" || type === "q") {
    const dirs = type === "b" ? BISHOP_DIRS : type === "r" ? ROOK_DIRS : QUEEN_DIRS;
    for (const [dr, dc] of dirs) {
      let nr = r + dr, nc = c + dc;
      while (inBounds(nr, nc)) {
        const target = board[idx(nr, nc)];
        if (!target) {
          moves.push({ from, to: idx(nr, nc) });
        } else {
          if (target.color !== color) moves.push({ from, to: idx(nr, nc) });
          break;
        }
        nr += dr;
        nc += dc;
      }
    }
  } else if (type === "k") {
    for (const [dr, dc] of KING_OFFSETS) {
      const nr = r + dr, nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      const target = board[idx(nr, nc)];
      if (!target || target.color !== color) moves.push({ from, to: idx(nr, nc) });
    }

    const rights = state.castling[color];
    const enemy = opponent(color);
    if (!isSquareAttacked(board, from, enemy)) {
      if (rights.kingSide) {
        const f = idx(r, 5), g = idx(r, 6), rookSq = idx(r, 7);
        const rook = board[rookSq];
        if (!board[f] && !board[g] && rook?.type === "r" && rook.color === color) {
          if (!isSquareAttacked(board, f, enemy) && !isSquareAttacked(board, g, enemy)) {
            moves.push({ from, to: g, castle: "king" });
          }
        }
      }
      if (rights.queenSide) {
        const d = idx(r, 3), b1 = idx(r, 2), knightSq = idx(r, 1), rookSq = idx(r, 0);
        const rook = board[rookSq];
        if (!board[d] && !board[b1] && !board[knightSq] && rook?.type === "r" && rook.color === color) {
          if (!isSquareAttacked(board, d, enemy) && !isSquareAttacked(board, b1, enemy)) {
            moves.push({ from, to: b1, castle: "queen" });
          }
        }
      }
    }
  }

  return moves;
}

// Aplica um movimento (já assumido legal) e devolve o próximo estado
// completo - usada tanto pelo applyMove público (depois de validar) quanto
// pela busca do bot (simulando candidatos sem precisar revalidar tudo).
function performMove(state, move, color) {
  const board = state.board.slice();
  const piece = board[move.from];
  const capturedPiece = board[move.to];
  const castling = { X: { ...state.castling.X }, O: { ...state.castling.O } };
  let enPassantTarget = null;

  board[move.from] = null;
  if (move.enPassant) {
    const capturedIdx = idx(Math.floor(move.from / SIZE), move.to % SIZE);
    board[capturedIdx] = null;
  }
  board[move.to] = move.promotion ? { type: move.promotion, color: piece.color } : piece;

  if (move.castle === "king") {
    const rank = Math.floor(move.from / SIZE);
    const rookFrom = idx(rank, 7), rookTo = idx(rank, 5);
    board[rookTo] = board[rookFrom];
    board[rookFrom] = null;
  } else if (move.castle === "queen") {
    const rank = Math.floor(move.from / SIZE);
    const rookFrom = idx(rank, 0), rookTo = idx(rank, 3);
    board[rookTo] = board[rookFrom];
    board[rookFrom] = null;
  }

  if (piece.type === "k") {
    castling[color] = { kingSide: false, queenSide: false };
  }
  if (piece.type === "r") {
    const file = move.from % SIZE;
    if (file === 0) castling[color].queenSide = false;
    if (file === 7) castling[color].kingSide = false;
  }
  if (capturedPiece?.type === "r") {
    const file = move.to % SIZE;
    if (file === 0) castling[capturedPiece.color].queenSide = false;
    if (file === 7) castling[capturedPiece.color].kingSide = false;
  }

  if (move.doubleStep) {
    const midRow = (Math.floor(move.from / SIZE) + Math.floor(move.to / SIZE)) / 2;
    enPassantTarget = idx(midRow, move.from % SIZE);
  }

  return {
    board,
    castling,
    enPassantTarget,
    turn: opponent(color),
    lastMove: { from: move.from, to: move.to },
  };
}

// Todos os movimentos realmente legais (já filtrando quem deixaria o
// próprio rei em xeque).
export function getLegalMoves(state, color) {
  const board = state.board;
  const moves = [];
  for (let from = 0; from < 64; from++) {
    const piece = board[from];
    if (!piece || piece.color !== color) continue;
    const pseudo = pieceMovesPseudo(board, from, state);
    for (const m of pseudo) {
      const next = performMove(state, m, color);
      const kingIdx = findKing(next.board, color);
      if (!isSquareAttacked(next.board, kingIdx, opponent(color))) moves.push(m);
    }
  }
  return moves;
}

export function applyMove(state, move, symbol) {
  const legal = getLegalMoves(state, symbol);
  const match = legal.find(
    (m) => m.from === move.from && m.to === move.to && (m.promotion || null) === (move.promotion || null)
  );
  if (!match) return null;
  return performMove(state, match, symbol);
}

export function checkResult(state) {
  const color = state.turn;
  const legal = getLegalMoves(state, color);
  if (legal.length > 0) return null;
  const kingIdx = findKing(state.board, color);
  const inCheck = isSquareAttacked(state.board, kingIdx, opponent(color));
  if (inCheck) return { winner: opponent(color) };
  return { winner: "draw" };
}

export function isInCheck(state, color) {
  const kingIdx = findKing(state.board, color);
  return isSquareAttacked(state.board, kingIdx, opponent(color));
}

function materialScore(board, color) {
  let score = 0;
  for (const cell of board) {
    if (!cell) continue;
    const val = PIECE_VALUES[cell.type];
    score += cell.color === color ? val : -val;
  }
  return score;
}

function isCapture(state, move) {
  return !!state.board[move.to] || move.enPassant;
}

function orderMoves(state, moves) {
  return moves.slice().sort((a, b) => (isCapture(state, b) ? 1 : 0) - (isCapture(state, a) ? 1 : 0));
}

// Busca negamax com poda alfa-beta - profundidade em "meios-lances" (a
// jogada do bot conta como 1). Retorna o valor do lado a favor de `color`.
function negamax(state, depth, alpha, beta, color) {
  const moves = getLegalMoves(state, color).filter((m) => !m.promotion || m.promotion === "q");
  if (moves.length === 0) {
    const inCheck = isInCheck(state, color);
    if (inCheck) return -100000 - depth;
    return 0;
  }
  if (depth === 0) return materialScore(state.board, color);

  let best = -Infinity;
  for (const m of orderMoves(state, moves)) {
    const next = performMove(state, m, color);
    const score = -negamax(next, depth - 1, -beta, -alpha, opponent(color));
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

function bestMoveNegamax(state, depth, symbol) {
  const moves = getLegalMoves(state, symbol).filter((m) => !m.promotion || m.promotion === "q");
  if (moves.length === 0) return null;

  let bestMove = moves[0];
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;

  for (const m of orderMoves(state, moves)) {
    const next = performMove(state, m, symbol);
    const score = -negamax(next, depth - 1, -beta, -alpha, opponent(symbol));
    if (score > bestScore) {
      bestScore = score;
      bestMove = m;
    }
    if (bestScore > alpha) alpha = bestScore;
  }
  return bestMove;
}

// easy: às vezes captura à toa, senão aleatório - joga bem devagar e comete
// erros. medium: olha só o resultado imediato da própria jogada (1 lance).
// hard: enxerga 3 meios-lances à frente com poda alfa-beta - joga tático,
// não deixa peça de graça na maioria das vezes.
export function botMove(state, symbol, difficulty = "medium") {
  const moves = getLegalMoves(state, symbol);
  if (moves.length === 0) return null;

  if (difficulty === "easy") {
    const captures = moves.filter((m) => isCapture(state, m));
    const pool = captures.length > 0 && Math.random() < 0.4 ? captures : moves;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    return { from: pick.from, to: pick.to, promotion: pick.promotion === "q" ? "q" : pick.promotion };
  }

  const depth = difficulty === "hard" ? 3 : 1;
  const pick = bestMoveNegamax(state, depth, symbol);
  if (!pick) return null;
  return { from: pick.from, to: pick.to, promotion: pick.promotion === "q" ? "q" : pick.promotion };
}
