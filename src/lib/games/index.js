import * as tictactoe from "./tictactoe.js";
import * as checkers from "./checkers.js";
import * as uno from "./uno.js";
import * as truco from "./truco.js";

export const GAMES = {
  tictactoe,
  checkers,
  uno,
  truco,
};

export const GAME_LIST = Object.values(GAMES);
