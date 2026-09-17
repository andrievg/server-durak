export const SUITS = ['♠', '♥', '♦', '♣'];
export const RANKS = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const RANK_VALUE = {
  '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

export function createDeck() {
  let id = 0;
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: id++, suit, rank, value: RANK_VALUE[rank] });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function canBeat(a, b, trumpSuit) {
  if (!a || !b) return false;
  const aTrump = a.suit === trumpSuit;
  const bTrump = b.suit === trumpSuit;
  if (bTrump && !aTrump) return true;
  if (!bTrump && aTrump) return false;
  if (a.suit !== b.suit) return false;
  return b.value > a.value;
}