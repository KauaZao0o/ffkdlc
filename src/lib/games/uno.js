export const id = "uno";
export const label = "🎴 Uno";

export const COLORS = ["red", "yellow", "green", "blue"];

function buildDeck() {
  const deck = [];
  for (const color of COLORS) {
    deck.push({ color, value: "0" });
    for (let n = 1; n <= 9; n++) {
      deck.push({ color, value: String(n) });
      deck.push({ color, value: String(n) });
    }
    for (const action of ["skip", "reverse", "draw2"]) {
      deck.push({ color, value: action });
      deck.push({ color, value: action });
    }
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ color: null, value: "wild" });
    deck.push({ color: null, value: "wild4" });
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

const SPECIAL = ["wild", "wild4", "skip", "reverse", "draw2"];

// Versão simplificada pra 2 jogadores: sem chamar "UNO" e sem pilha
// (stacking) de compra - "pular"/"inverter" com só 2 jogadores dão no
// mesmo: a pessoa que jogou joga de novo.
export function createInitialState() {
  const deck = shuffle(buildDeck());
  const handX = deck.splice(0, 7);
  const handO = deck.splice(0, 7);

  let discardCard = null;
  let guard = 0;
  while (guard < 60) {
    discardCard = deck.shift();
    guard++;
    if (!SPECIAL.includes(discardCard.value)) break;
    deck.push(discardCard);
  }

  return {
    deck,
    discard: [discardCard],
    hands: { X: handX, O: handO },
    currentColor: discardCard.color,
  };
}

function cardMatches(card, topCard, currentColor) {
  if (card.color === null) return true;
  return card.color === currentColor || card.value === topCard.value;
}

function drawCards(state, symbol, count) {
  let deck = state.deck.slice();
  let discard = state.discard.slice();
  const drawn = [];
  for (let i = 0; i < count; i++) {
    if (deck.length === 0) {
      const top = discard[discard.length - 1];
      const rest = discard.slice(0, -1);
      if (rest.length === 0) break;
      deck = shuffle(rest);
      discard = [top];
    }
    const card = deck.shift();
    if (card) drawn.push(card);
  }
  const hands = { ...state.hands, [symbol]: [...state.hands[symbol], ...drawn] };
  return { ...state, deck, discard, hands };
}

// move = { action: "draw" } | { action: "play", cardIndex, chosenColor? }
export function applyMove(state, move, symbol) {
  const opponent = symbol === "X" ? "O" : "X";
  const topCard = state.discard[state.discard.length - 1];

  if (move.action === "draw") {
    const next = drawCards(state, symbol, 1);
    return { ...next, turn: opponent };
  }

  if (move.action === "play") {
    const hand = state.hands[symbol];
    const card = hand[move.cardIndex];
    if (!card) return null;
    if (!cardMatches(card, topCard, state.currentColor)) return null;

    const nextHand = hand.slice();
    nextHand.splice(move.cardIndex, 1);
    let next = { ...state, hands: { ...state.hands, [symbol]: nextHand }, discard: [...state.discard, card] };
    let nextTurn = opponent;
    let chosenColor = card.color;

    if (card.color === null) {
      chosenColor = COLORS.includes(move.chosenColor) ? move.chosenColor : COLORS[0];
      if (card.value === "wild4") next = drawCards(next, opponent, 4);
    } else if (card.value === "draw2") {
      next = drawCards(next, opponent, 2);
    } else if (card.value === "skip" || card.value === "reverse") {
      nextTurn = symbol;
    }

    next.currentColor = chosenColor;
    return { ...next, turn: nextTurn };
  }

  return null;
}

export function checkResult(state) {
  if (state.hands.X.length === 0) return { winner: "X" };
  if (state.hands.O.length === 0) return { winner: "O" };
  return null;
}

function bestColorForHand(hand) {
  const counts = { red: 0, yellow: 0, green: 0, blue: 0 };
  hand.forEach((c) => {
    if (c.color) counts[c.color] += 1;
  });
  return COLORS.reduce((best, color) => (counts[color] > counts[best] ? color : best), COLORS[0]);
}

function playCardResult(hand, index) {
  const card = hand[index];
  if (card.color === null) return { action: "play", cardIndex: index, chosenColor: bestColorForHand(hand) };
  return { action: "play", cardIndex: index };
}

// difficulty: "easy" (joga qualquer carta válida ao acaso, cor aleatória no
// curinga) | "medium" (guarda os curingas pra quando não tiver outra opção,
// escolhe a cor que mais tem na mão) | "hard" (igual ao médio, mas quando o
// adversário está com poucas cartas prioriza cartas ofensivas - +2/+4/pular).
export function botMove(state, symbol, difficulty = "medium") {
  const hand = state.hands[symbol];
  const topCard = state.discard[state.discard.length - 1];
  const playableIndices = hand.map((c, i) => i).filter((i) => cardMatches(hand[i], topCard, state.currentColor));

  if (playableIndices.length === 0) return { action: "draw" };

  if (difficulty === "easy") {
    const index = playableIndices[Math.floor(Math.random() * playableIndices.length)];
    const card = hand[index];
    if (card.color === null) {
      const chosenColor = COLORS[Math.floor(Math.random() * COLORS.length)];
      return { action: "play", cardIndex: index, chosenColor };
    }
    return { action: "play", cardIndex: index };
  }

  if (difficulty === "hard") {
    const opponentSymbol = symbol === "X" ? "O" : "X";
    if (state.hands[opponentSymbol].length <= 2) {
      const offensive = playableIndices.find((i) => ["draw2", "wild4", "skip", "reverse"].includes(hand[i].value));
      if (offensive !== undefined) return playCardResult(hand, offensive);
    }
  }

  const nonWildIndex = playableIndices.find((i) => hand[i].color !== null);
  const chosenIndex = nonWildIndex !== undefined ? nonWildIndex : playableIndices[0];
  return playCardResult(hand, chosenIndex);
}
