import { RANKS } from "./cards.js";

export function isTrump(card, state) {
  if (card.suit === "JOKER") return true;
  if (card.rank === state.level) return true;
  if (card.suit === state.trumpSuit) return true;
  return false;
}

export function rankValue(rank) {
  return RANKS.indexOf(rank);
}

export function cardPower(card, state) {
  if (card.rank === "大王") return 100;
  if (card.rank === "小王") return 90;

  if (isTrump(card, state)) {
    if (card.rank === state.level) return 80;
    return 70 + rankValue(card.rank);
  }

  return rankValue(card.rank);
}
