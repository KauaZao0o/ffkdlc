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
    trickResults: [],
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
  const trickResults = [...(state.trickResults || []), roundWinner || "draw"];
  // Quem venceu a rodada lidera a próxima; num empate, continua quem ia jogar.
  const nextTurn = roundWinner || state.turn;

  return {
    hands,
    table: [],
    roundsWon,
    roundsPlayed,
    trickResults,
    turn: nextTurn,
    lastRound: { a, b, winner: roundWinner },
  };
}

// Regra de desempate do truco: quem vence as duas primeiras rodadas fecha a
// mão; se a 1ª empata, quem vencer a 2ª já fecha (não precisa da 3ª); se
// alguém vence a 1ª e a 2ª empata, esse alguém já fecha a mão; se a 1ª e a
// 2ª forem de jogadores diferentes, decide a 3ª - e se a 3ª também
// empatar, vence quem ganhou a 1ª rodada (ela "vale mais" no desempate).
export function checkResult(state) {
  const [r1, r2, r3] = state.trickResults || [];
  if (!r1) return null;

  if (r1 !== "draw") {
    if (!r2) return null;
    if (r2 === r1) return { winner: r1 };
    if (r2 === "draw") return { winner: r1 };
    if (!r3) return null;
    return { winner: r3 === "draw" ? r1 : r3 };
  }

  // r1 === "draw"
  if (!r2) return null;
  if (r2 !== "draw") return { winner: r2 };
  if (!r3) return null;
  return r3 === "draw" ? { winner: "draw" } : { winner: r3 };
}

// difficulty: "easy" (joga carta aleatória da mão) | "medium" (se o
// adversário já jogou, vence gastando a carta mais fraca possível ou
// descarta a mais fraca; se for o primeiro a jogar, evita gastar a manilha
// logo de cara) | "hard" (igual ao médio, mas quando não dá pra vencer a
// rodada só descarta manilha se não sobrar outra carta - guarda ela pra
// rodada decisiva).
export function botMove(state, symbol, difficulty = "medium") {
  const hand = state.hands[symbol];
  if (hand.length === 0) return null;

  if (difficulty === "easy") {
    return { cardIndex: Math.floor(Math.random() * hand.length) };
  }

  const opponentPlay = state.table.find((p) => p.symbol !== symbol);
  const ranked = hand
    .map((card, i) => ({ i, strength: cardStrength(card, state.manilha) }))
    .sort((a, b) => a.strength - b.strength);

  if (opponentPlay) {
    const opponentStrength = cardStrength(opponentPlay.card, state.manilha);
    const winning = ranked.filter((c) => c.strength > opponentStrength);
    if (winning.length > 0) return { cardIndex: winning[0].i };

    if (difficulty === "hard") {
      const nonManilha = ranked.filter((c) => c.strength < 100);
      const pool = nonManilha.length > 0 ? nonManilha : ranked;
      return { cardIndex: pool[0].i };
    }
    return { cardIndex: ranked[0].i };
  }

  const nonManilha = ranked.filter((c) => c.strength < 100);
  const pool = nonManilha.length > 0 ? nonManilha : ranked;
  return { cardIndex: pool[0].i };
}
