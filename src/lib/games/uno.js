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
