export const id = "truco";
export const label = "🃏 Truco";

const RANK_ORDER = ["4", "5", "6", "7", "Q", "J", "K", "A", "2", "3"];
const SUITS = ["diamonds", "spades", "hearts", "clubs"];
// Ordem de força das manilhas (truco paulista): paus > copas > espadas > ouros.
const SUIT_STRENGTH = { diamonds: 1, spades: 2, hearts: 3, clubs: 4 };

function buildDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANK_ORDER) deck.push({ rank, suit });
  }
  return deck;
}

function shuffle(deck) {
  const arr = deck.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function manilhaRank(vira) {
  const i = RANK_ORDER.indexOf(vira.rank);
  return RANK_ORDER[(i + 1) % RANK_ORDER.length];
}

function cardStrength(card, manilha) {
  if (card.rank === manilha) return 100 + SUIT_STRENGTH[card.suit];
  return RANK_ORDER.indexOf(card.rank);
}

// Versão bem simplificada do truco: sem pedir truco/aumentar aposta (isso
// fica pra uma próxima melhoria) - só o jogo de cartas em si. Cada mão vale
// 1 ponto; melhor de 3 rodadas fecha a mão; primeiro a 6 pontos vence a
// partida (contagem de partida fica por conta do placar geral no GameContext).
export function createInitialState() {
  const deck = shuffle(buildDeck());
  const vira = deck.shift();
  const handX = deck.splice(0, 3);
  const handO = deck.splice(0, 3);
  return {
    vira,
    manilha: manilhaRank(vira),
    hands: { X: handX, O: handO },
    table: [],
    roundsWon: { X: 0, O: 0 },
    roundsPlayed: 0,
    lastRound: null,
  };
}

// move = { cardIndex }
export function applyMove(state, move, symbol) {
  const hand = state.hands[symbol];
  const card = hand[move.cardIndex];
  if (!card) return null;
  if (state.table.some((play) => play.symbol === symbol)) return null;

  const nextHand = hand.slice();
  nextHand.splice(move.cardIndex, 1);
  const hands = { ...state.hands, [symbol]: nextHand };
  const table = [...state.table, { symbol, card }];

  if (table.length < 2) {
    return { hands, table, turn: symbol === "X" ? "O" : "X" };
  }

  const [a, b] = table;
  const strA = cardStrength(a.card, state.manilha);
  const strB = cardStrength(b.card, state.manilha);
  const roundWinner = strA === strB ? null : strA > strB ? a.symbol : b.symbol;

  const roundsWon = { ...state.roundsWon };
  if (roundWinner) roundsWon[roundWinner] += 1;
  const roundsPlayed = state.roundsPlayed + 1;
  const nextTurn = roundWinner || state.turn;

  return {
    hands,
    table: [],
    roundsWon,
    roundsPlayed,
    turn: nextTurn,
    lastRound: { a, b, winner: roundWinner },
  };
}

export function checkResult(state) {
  const { roundsWon, roundsPlayed } = state;
  if (roundsWon.X >= 2) return { winner: "X" };
  if (roundsWon.O >= 2) return { winner: "O" };
  if (roundsPlayed >= 3) {
    if (roundsWon.X > roundsWon.O) return { winner: "X" };
    if (roundsWon.O > roundsWon.X) return { winner: "O" };
    return { winner: "draw" };
  }
  return null;
}
