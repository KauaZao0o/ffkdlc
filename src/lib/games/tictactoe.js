import { checkWinner } from "@/lib/ticTacToe";

export const id = "tictactoe";
export const label = "⭕ Jogo da velha";

export function createInitialState() {
  return { board: Array(9).fill(null) };
}

// move = { index }
export function applyMove(state, move, symbol) {
  if (state.board[move.index]) return null;
  const board = state.board.slice();
  board[move.index] = symbol;
  return { board, turn: symbol === "X" ? "O" : "X" };
}

export function checkResult(state) {
  const result = checkWinner(state.board);
  if (!result) return null;
  return { winner: result.winner, line: result.line };
}
