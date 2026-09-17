import { createDeck, canBeat } from './deck.js';

export function initGame() {
  const deck = createDeck();
  const trumpCard = deck[0];
  const trumpSuit = trumpCard.suit;

  const hands = [[], []];
  for (let i = 0; i < 6; i++) {
    hands[0].push(deck.pop());
    hands[1].push(deck.pop());
  }

  return {
    deck,
    trumpCard,
    trumpSuit,
    hands,
    table: [],
    discard: [],
    attacker: 0,
    defender: 1,
    phase: 'attack',
    winner: null,
    round: 1,
  };
}

export function canAddCard(state, card) {
  if (!state.table.length) return true;
  if (state.table.length >= 6) return false;
  const ranks = new Set();
  for (const p of state.table) {
    ranks.add(p.attack.rank);
    if (p.defend) ranks.add(p.defend.rank);
  }
  return ranks.has(card.rank);
}

export function canDefend(state, attackCard, defendCard) {
  return canBeat(attackCard, defendCard, state.trumpSuit);
}

export function unbeatenCards(table) {
  return table.filter((p) => !p.defend).map((p) => p.attack);
}

export function isRoundEnd(state) {
  return state.table.length > 0 && state.table.every((p) => p.defend);
}

export function defenderTakes(state) {
  const hands = state.hands.map((h) => [...h]);
  for (const pair of state.table) {
    hands[state.defender].push(pair.attack);
    if (pair.defend) hands[state.defender].push(pair.defend);
  }
  return {
    ...state,
    hands,
    table: [],
    attacker: state.defender,
    defender: state.attacker,
    round: state.round + 1,
    phase: 'attack',
  };
}

export function defenderBeats(state) {
  const discard = [
    ...state.discard,
    ...state.table.flatMap((p) =>
      p.defend ? [p.attack, p.defend] : [p.attack]
    ),
  ];
  return {
    ...state,
    table: [],
    discard,
    attacker: state.defender,
    defender: state.attacker,
    round: state.round + 1,
    phase: 'attack',
  };
}

export function refillHands(state) {
  const deck = [...state.deck];
  const hands = state.hands.map((h) => [...h]);
  for (const p of [state.attacker, state.defender]) {
    while (hands[p].length < 6 && deck.length > 0) {
      hands[p].push(deck.pop());
    }
  }
  return { ...state, deck, hands };
}

export function checkGameOver(state) {
  if (state.deck.length > 0) return null;
  const out = state.hands.findIndex((h) => h.length === 0);
  return out === -1 ? null : out;
}

export function applyAction(state, playerIndex, action, payload) {
  if (state.phase === 'over') return { error: 'Игра окончена' };

  if (action === 'attack') {
    if (state.attacker !== playerIndex) return { error: 'Не ваш ход' };
    if (unbeatenCards(state.table).length > 0) return { error: 'Сначала отбейтесь' };
    const card = state.hands[playerIndex].find((c) => c.id === payload.cardId);
    if (!card) return { error: 'Карты нет в руке' };
    if (!canAddCard(state, card)) return { error: 'Нельзя подкинуть' };

    const hands = state.hands.map((h) => [...h]);
    hands[playerIndex] = hands[playerIndex].filter((c) => c.id !== card.id);
    return {
      state: {
        ...state,
        hands,
        table: [...state.table, { attack: card, defend: null }],
        phase: 'defend',
      },
    };
  }

  if (action === 'defend') {
    if (state.defender !== playerIndex) return { error: 'Не ваш ход' };
    const pair = state.table.find((p) => !p.defend);
    if (!pair) return { error: 'Нечего бить' };
    const card = state.hands[playerIndex].find((c) => c.id === payload.cardId);
    if (!card) return { error: 'Карты нет' };
    if (!canDefend(state, pair.attack, card)) return { error: 'Не бьёт' };

    const hands = state.hands.map((h) => [...h]);
    hands[playerIndex] = hands[playerIndex].filter((c) => c.id !== card.id);
    const table = state.table.map((p) =>
      p === pair ? { ...p, defend: card } : p
    );
    return { state: { ...state, hands, table } };
  }

  if (action === 'take') {
    if (state.defender !== playerIndex) return { error: 'Не ваш ход' };
    let s = defenderTakes(state);
    s = refillHands(s);
    const over = checkGameOver(s);
    if (over !== null) s = { ...s, winner: over, phase: 'over' };
    return { state: s };
  }

  if (action === 'pass') {
    if (state.attacker !== playerIndex) return { error: 'Не ваш ход' };
    if (!isRoundEnd(state)) return { error: 'Раунд не закончен' };
    let s = defenderBeats(state);
    s = refillHands(s);
    const over = checkGameOver(s);
    if (over !== null) s = { ...s, winner: over, phase: 'over' };
    return { state: s };
  }

  return { error: 'Неизвестное действие' };
}

export function sanitize(state, myIndex) {
  return {
    ...state,
    hands: state.hands.map((h, i) =>
      i === myIndex ? h : h.map(() => ({ hidden: true }))
    ),
  };
}