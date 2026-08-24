import * as tictactoe from "./tictactoe.js";
import * as checkers from "./checkers.js";
import * as uno from "./uno.js";
import * as truco from "./truco.js";
import * as chess from "./chess.js";
import * as sinuca from "./sinuca.js";

export const GAMES = {
  tictactoe,
  checkers,
  uno,
  truco,
  chess,
  sinuca,
};

export const GAME_LIST = Object.values(GAMES);
