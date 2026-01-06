import { cardPower } from "./rules.js";

export function analyzePlay(cards, state) {
  if (cards.length === 1) {
    return {
      type: "single",
      main: cards[0],
      power: cardPower(cards[0], state),
      cards
    };
  }

  // 是否对子
  if (
    cards.length === 2 &&
    cards[0].rank === cards[1].rank &&
    cards[0].suit === cards[1].suit
  ) {
    return {
      type: "pair",
      main: cards[0],
      power: cardPower(cards[0], state),
      cards
    };
  }

  // 暂时：其余一律视为甩牌（后续再细分拖拉机）
  let max = cards.reduce((a, b) =>
    cardPower(a, state) > cardPower(b, state) ? a : b
  );

  return {
    type: "throw",
    main: max,
    power: cardPower(max, state),
    cards
  };
}

export function comparePattern(a, b) {
  if (a.type !== b.type) return a.type === "single" ? -1 : 1;
  return a.power - b.power;
}
