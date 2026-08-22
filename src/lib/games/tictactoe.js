export const id = "tictactoe";
export const label = "⭕ Jogo da velha";

export const DEFAULT_RULES = { mode: "classic" };

export const MODE_OPTIONS = [
  { id: "classic", label: "Clássico", description: "Tabuleiro 3x3, três em linha vence" },
  { id: "big", label: "Tabuleiro grande", description: "Tabuleiro 5x5, quatro em linha vence" },
  { id: "vanishing", label: "Infinito", description: "3x3, só 3 peças por vez - a mais velha some quando joga a 4ª" },
];

function sizeForMode(mode) {
  return mode === "big" ? 5 : 3;
}
function winLengthForMode(mode) {
  return mode === "big" ? 4 : 3;
}

const linesCache = new Map();

// Gera todas as linhas (horizontais, verticais, diagonais) de "winLength"
// casas seguidas possíveis num tabuleiro size x size - generaliza o que
// antes era uma lista fixa de 8 linhas só pro 3x3.
function getLines(size, winLength) {
  const key = `${size}-${winLength}`;
  if (linesCache.has(key)) return linesCache.get(key);

  const lines = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (c + winLength <= size) {
        lines.push(Array.from({ length: winLength }, (_, k) => r * size + c + k));
      }
      if (r + winLength <= size) {
        lines.push(Array.from({ length: winLength }, (_, k) => (r + k) * size + c));
      }
      if (r + winLength <= size && c + winLength <= size) {
        lines.push(Array.from({ length: winLength }, (_, k) => (r + k) * size + (c + k)));
      }
      if (r + winLength <= size && c - winLength + 1 >= 0) {
        lines.push(Array.from({ length: winLength }, (_, k) => (r + k) * size + (c - k)));
      }
    }
  }
  linesCache.set(key, lines);
  return lines;
}

function checkWinnerGeneric(board, size, winLength) {
  const lines = getLines(size, winLength);
  for (const line of lines) {
    const first = board[line[0]];
    if (first && line.every((i) => board[i] === first)) return { winner: first, line };
  }
  if (board.every(Boolean)) return { winner: "draw", line: null };
  return null;
}

export function createInitialState(rules = {}) {
  const mode = rules?.mode || DEFAULT_RULES.mode;
  const size = sizeForMode(mode);
  return {
    mode,
    size,
    winLength: winLengthForMode(mode),
    board: Array(size * size).fill(null),
    marks: { X: [], O: [] }, // só usado no modo "infinito" (ordem de jogadas em campo)
    winLine: null,
  };
}

// Aplica a jogada num tabuleiro - se for o modo "infinito" e a pessoa já
// tiver 3 peças em campo, a mais antiga some antes da nova entrar.
function boardAfterMove(state, index, symbol) {
  const board = state.board.slice();
  const marks = { X: state.marks.X.slice(), O: state.marks.O.slice() };

  if (state.mode === "vanishing") {
    const own = marks[symbol];
    if (own.length >= 3) {
      const removed = own.shift();
      board[removed] = null;
    }
    own.push(index);
  }

  board[index] = symbol;
  return { board, marks };
}

// move = { index }
export function applyMove(state, move, symbol) {
  if (state.board[move.index]) return null;
  const { board, marks } = boardAfterMove(state, move.index, symbol);
  return { board, marks, turn: symbol === "X" ? "O" : "X" };
}

export function checkResult(state) {
  const result = checkWinnerGeneric(state.board, state.size, state.winLength);
  if (!result) return null;
  return { winner: result.winner, line: result.line };
}

// Bot: vence se puder, senão bloqueia o adversário, senão prioriza a casa
// que participa do maior número de linhas de vitória possíveis (no 3x3
// clássico isso já dá pra fazer com minimax completo, jogo perfeito - no
// tabuleiro grande e no infinito isso explodiria o navegador, então usam a
// mesma heurística de vencer/bloquear/melhor casa.
export function botMove(state, symbol, difficulty = "medium") {
  const { board, size, winLength, mode } = state;
  const opponent = symbol === "X" ? "O" : "X";
  const empties = board.map((c, i) => (c ? null : i)).filter((i) => i !== null);
  if (empties.length === 0) return null;

  if (difficulty === "easy") {
    return { index: empties[Math.floor(Math.random() * empties.length)] };
  }

  function resultAfter(i, sym) {
    const { board: nextBoard } = boardAfterMove(state, i, sym);
    return checkWinnerGeneric(nextBoard, size, winLength);
  }

  function findWinningMove(sym) {
    for (const i of empties) {
      const result = resultAfter(i, sym);
      if (result && result.winner === sym) return i;
    }
    return null;
  }

  if (difficulty === "hard" && mode === "classic") {
    return { index: bestMoveMinimax(board, symbol) };
  }

  let index = findWinningMove(symbol);
  if (index === null) index = findWinningMove(opponent);
  if (index === null) {
    const lines = getLines(size, winLength);
    const scored = empties.map((i) => ({ i, score: lines.filter((line) => line.includes(i)).length }));
    scored.sort((a, b) => b.score - a.score);
    const top = scored[0].score;
    const best = scored.filter((s) => s.score === top);
    index = best[Math.floor(Math.random() * best.length)].i;
  }

  return { index };
}

// Minimax completo - só usado no 3x3 clássico (9 casas, rápido o
// suficiente); joga perfeito (o máximo que dá pra fazer contra ele é
// empatar).
function minimaxScore(board, mainSymbol, turnSymbol, depth) {
  const result = checkWinnerGeneric(board, 3, 3);
  if (result) {
    if (result.winner === "draw") return 0;
    if (result.winner === mainSymbol) return 10 - depth;
    return depth - 10;
  }
  const empties = board.map((c, i) => (c ? null : i)).filter((i) => i !== null);
  const nextSymbol = turnSymbol === "X" ? "O" : "X";
  const isMaximizing = turnSymbol === mainSymbol;
  let best = isMaximizing ? -Infinity : Infinity;
  for (const i of empties) {
    const copy = board.slice();
    copy[i] = turnSymbol;
    const score = minimaxScore(copy, mainSymbol, nextSymbol, depth + 1);
    best = isMaximizing ? Math.max(best, score) : Math.min(best, score);
  }
  return best;
}

function bestMoveMinimax(board, symbol) {
  const empties = board.map((c, i) => (c ? null : i)).filter((i) => i !== null);
  let bestScore = -Infinity;
  let bestIndex = empties[0];
  for (const i of empties) {
    const copy = board.slice();
    copy[i] = symbol;
    const score = minimaxScore(copy, symbol, symbol === "X" ? "O" : "X", 0);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return bestIndex;
}
