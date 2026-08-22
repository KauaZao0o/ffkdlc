export const id = "checkers";
export const label = "🔴 Dama";

const SIZE = 8;
const DIRS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

function idx(r, c) {
  return r * SIZE + c;
}

function inBounds(r, c) {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

export const DEFAULT_RULES = {
  mandatoryCapture: false,
  chainCapture: false,
  flyingKing: false,
};

export const RULE_OPTIONS = [
  { id: "mandatoryCapture", label: "Captura obrigatória", description: "Se puder capturar, é obrigado a jogar a captura" },
  { id: "chainCapture", label: "Sequência de capturas", description: "Depois de capturar, se a mesma peça puder capturar de novo, continua na mesma jogada" },
  { id: "flyingKing", label: "Dama voadora", description: "A dama anda/captura qualquer distância na diagonal, não só uma casa" },
];

export function createInitialState(rules = {}) {
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
  return { board, rules: { ...DEFAULT_RULES, ...rules }, mustContinueFrom: null };
}

function pieceMoveDirs(piece) {
  if (piece.king) return DIRS;
  const forward = piece.symbol === "X" ? -1 : 1;
  return DIRS.filter(([dr]) => dr === forward);
}

// Retorna { simple: [to,...], captures: [{to, captured},...] } pra uma peça
// específica - considera dama voadora (anda/captura qualquer distância) se
// a regra estiver ligada, senão só 1 casa (andar) ou 2 casas (capturar),
// que é como a maioria conhece o jogo.
function getMovesForPiece(state, from) {
  const { board, rules } = state;
  const piece = board[from];
  if (!piece) return { simple: [], captures: [] };

  const rFrom = Math.floor(from / SIZE);
  const cFrom = from % SIZE;
  const flying = rules?.flyingKing && piece.king;
  const dirs = pieceMoveDirs(piece);
  const simple = [];
  const captures = [];

  for (const [dr, dc] of dirs) {
    if (flying) {
      let r = rFrom + dr;
      let c = cFrom + dc;
      while (inBounds(r, c) && !board[idx(r, c)]) {
        simple.push(idx(r, c));
        r += dr;
        c += dc;
      }
      if (inBounds(r, c) && board[idx(r, c)] && board[idx(r, c)].symbol !== piece.symbol) {
        const capturedIdx = idx(r, c);
        let lr = r + dr;
        let lc = c + dc;
        while (inBounds(lr, lc) && !board[idx(lr, lc)]) {
          captures.push({ to: idx(lr, lc), captured: capturedIdx });
          lr += dr;
          lc += dc;
        }
      }
    } else {
      const r1 = rFrom + dr;
      const c1 = cFrom + dc;
      if (!inBounds(r1, c1)) continue;
      if (!board[idx(r1, c1)]) {
        simple.push(idx(r1, c1));
        continue;
      }
      if (board[idx(r1, c1)].symbol === piece.symbol) continue;
      const r2 = rFrom + dr * 2;
      const c2 = cFrom + dc * 2;
      if (inBounds(r2, c2) && !board[idx(r2, c2)]) {
        captures.push({ to: idx(r2, c2), captured: idx(r1, c1) });
      }
    }
  }
  return { simple, captures };
}

// Exportada pra a interface poder mostrar onde a peça selecionada pode ir
// (bolinhas de destino), já respeitando captura obrigatória.
export function getLegalMoves(state, symbol) {
  const board = state.board;
  const moves = [];
  let anyCapture = false;
  const restrictFrom = state.mustContinueFrom;

  for (let from = 0; from < 64; from++) {
    if (restrictFrom !== null && restrictFrom !== undefined && from !== restrictFrom) continue;
    const piece = board[from];
    if (!piece || piece.symbol !== symbol) continue;
    const { simple, captures } = getMovesForPiece(state, from);
    for (const to of simple) moves.push({ from, to, capture: false });
    for (const c of captures) {
      moves.push({ from, to: c.to, capture: true, captured: c.captured });
      anyCapture = true;
    }
  }

  if (state.rules?.mandatoryCapture && anyCapture) {
    return moves.filter((m) => m.capture);
  }
  return moves;
}

// move = { from, to } (índices 0-63)
export function applyMove(state, move, symbol) {
  const { from, to } = move;
  const board = state.board;
  const piece = board[from];
  if (!piece || piece.symbol !== symbol) return null;
  if (to < 0 || to >= 64 || board[to]) return null;

  const restrictFrom = state.mustContinueFrom;
  if (restrictFrom !== null && restrictFrom !== undefined && from !== restrictFrom) return null;

  const { simple, captures } = getMovesForPiece(state, from);
  const captureMove = captures.find((c) => c.to === to);
  if (!captureMove && !simple.includes(to)) return null;

  if (state.rules?.mandatoryCapture) {
    const anyCapture = getLegalMoves(state, symbol).some((m) => m.capture);
    if (anyCapture && !captureMove) return null;
  }

  const next = board.slice();
  next[from] = null;
  if (captureMove) next[captureMove.captured] = null;

  const rTo = Math.floor(to / SIZE);
  const becomesKing = piece.king || (piece.symbol === "X" && rTo === 0) || (piece.symbol === "O" && rTo === SIZE - 1);
  next[to] = { symbol: piece.symbol, king: becomesKing };

  let turn = symbol === "X" ? "O" : "X";
  let mustContinueFrom = null;

  if (captureMove && state.rules?.chainCapture) {
    const { captures: nextCaptures } = getMovesForPiece({ board: next, rules: state.rules }, to);
    if (nextCaptures.length > 0) {
      turn = symbol;
      mustContinueFrom = to;
    }
  }

  return { board: next, turn, mustContinueFrom };
}

export function checkResult(state) {
  const hasX = state.board.some((p) => p?.symbol === "X");
  const hasO = state.board.some((p) => p?.symbol === "O");
  if (!hasX) return { winner: "O" };
  if (!hasO) return { winner: "X" };
  return null;
}

function leavesCaptureOpportunity(state, symbol, move) {
  const opponent = symbol === "X" ? "O" : "X";
  const patch = applyMove(state, move, symbol);
  if (!patch) return false;
  return getLegalMoves({ board: patch.board, rules: state.rules, mustContinueFrom: null }, opponent).some((m) => m.capture);
}

// difficulty: "easy" (qualquer jogada legal, aleatória) | "medium" (prioriza
// captura quando tem) | "hard" (prioriza captura e, entre as jogadas sem
// captura, evita deixar peça exposta pro adversário capturar de volta).
export function botMove(state, symbol, difficulty = "medium") {
  const moves = getLegalMoves(state, symbol);
  if (moves.length === 0) return null;

  if (difficulty === "easy") {
    const pick = moves[Math.floor(Math.random() * moves.length)];
    return { from: pick.from, to: pick.to };
  }

  const captures = moves.filter((m) => m.capture);
  if (captures.length > 0) {
    const pick = captures[Math.floor(Math.random() * captures.length)];
    return { from: pick.from, to: pick.to };
  }

  let pool = moves;
  if (difficulty === "hard") {
    const safe = moves.filter((m) => !leavesCaptureOpportunity(state, symbol, m));
    if (safe.length > 0) pool = safe;
  }

  const pick = pool[Math.floor(Math.random() * pool.length)];
  return { from: pick.from, to: pick.to };
}
