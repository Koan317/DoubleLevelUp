// trump-reveal.js

(function () {

  const POWER = {
    ONE_WANG_ONE: 1,
    ONE_WANG_TWO: 2,
    DOUBLE_SJ: 3,
    DOUBLE_BJ: 4,
    SINGLE_JOKER: 1,
    DOUBLE_SJ_JOKER: 2,
    DOUBLE_BJ_JOKER: 3
  };

  function analyzeReveal(cards, level, options = {}) {
    const { requireSameColor = false, allowDoubleJokers = true } = options;
    const isJokerLevel = level === "王";
    const jokers = cards.filter(c => c.suit === "JOKER");
    const mains  = cards.filter(c => c.rank === level);

    if (isJokerLevel) {
      if (jokers.length === 1 && cards.length === 1) {
        return {
          type: "SINGLE_JOKER",
          power: POWER.SINGLE_JOKER,
          trumpSuit: null,
          jokerRank: jokers[0].rank
        };
      }
      if (allowDoubleJokers && jokers.length === 2) {
        const isBig = jokers.every(joker => joker.rank === "BJ");
        if (!isBig && !jokers.every(joker => joker.rank === "SJ")) return null;
        return {
          type: isBig ? "DOUBLE_BJ" : "DOUBLE_SJ",
          power: isBig ? POWER.DOUBLE_BJ_JOKER : POWER.DOUBLE_SJ_JOKER,
          trumpSuit: null
        };
      }
      return null;
    }

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
    return revealRank(newR) > revealRank(oldR);
  }

  function revealRank(reveal) {
    if (!reveal) return 0;
    switch (reveal.type) {
      case "DOUBLE_BJ":
        return 4;
      case "DOUBLE_SJ":
        return 3;
      case "ONE_WANG_TWO":
        return 2;
      case "ONE_WANG_ONE":
      case "SINGLE_JOKER":
        return 1;
      default:
        return reveal.power ?? 0;
    }
  }

  window.Trump = {
    analyzeReveal,
    canOverride
  };

})();
