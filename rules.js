export function isTrump(card, state) {
  if (card.suit === "JOKER") return true;
  if (card.rank === state.level) return true;
  if (card.suit === state.trumpSuit) return true;
  return false;
}

export function cardValue(card, state) {
  if (card.rank === "大王") return 100;
  if (card.rank === "小王") return 90;
  return RANKS.indexOf(card.rank);
}
