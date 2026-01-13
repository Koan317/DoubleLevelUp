// trump.js

(function () {

  const POWER = {
    ONE_WANG_ONE: 1,
    ONE_WANG_TWO: 2,
    DOUBLE_SJ: 3,
    DOUBLE_BJ: 4
  };

  function analyzeReveal(cards, level, options = {}) {
    const { requireSameColor = false, allowDoubleJokers = true } = options;
    const jokers = cards.filter(c => c.suit === "JOKER");
    const mains  = cards.filter(c => c.rank === level);

    if (allowDoubleJokers && jokers.length === 2) {
      return {
        type: cards[0].rank === "BJ" ? "DOUBLE_BJ" : "DOUBLE_SJ",
        power: cards[0].rank === "BJ" ? POWER.DOUBLE_BJ : POWER.DOUBLE_SJ,
        trumpSuit: null
      };
    }

    if (jokers.length === 1 && mains.length >= 1) {
      if (requireSameColor && !hasSameColorJoker(jokers[0], mains[0])) {
        return null;
      }
      return {
        type: mains.length >= 2 ? "ONE_WANG_TWO" : "ONE_WANG_ONE",
        power: mains.length >= 2 ? POWER.ONE_WANG_TWO : POWER.ONE_WANG_ONE,
        trumpSuit: mains[0].suit
      };
    }

    return null;
  }

  function hasSameColorJoker(joker, mainCard) {
    const jokerIsRed = joker.rank === "BJ";
    const mainIsRed = mainCard.suit === "♥" || mainCard.suit === "♦";
    return jokerIsRed === mainIsRed;
  }

  function canOverride(newR, oldR) {
    if (!oldR) return true;
    return newR.power > oldR.power;
  }

  window.Trump = {
    analyzeReveal,
    canOverride
  };

})();
