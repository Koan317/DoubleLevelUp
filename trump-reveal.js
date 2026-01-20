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
  const SUITS = ["♠", "♥", "♣", "♦"];

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

  function isBigJoker(card) {
    return card.suit === "JOKER" && card.rank === "BJ";
  }

  function isSmallJoker(card) {
    return card.suit === "JOKER" && card.rank === "SJ";
  }

  function isRedSuit(suit) {
    return suit === "♥" || suit === "♦";
  }

  function jokerMatchesSuit(joker, suit) {
    return isRedSuit(suit) ? isBigJoker(joker) : isSmallJoker(joker);
  }

  function isSuitKey(key) {
    return SUITS.includes(key);
  }

  function isOneWangUpgrade(prevReveal, nextReveal) {
    if (!prevReveal || !nextReveal) return false;
    if (prevReveal.type !== "ONE_WANG_ONE" || nextReveal.type !== "ONE_WANG_TWO") {
      return false;
    }
    return prevReveal.trumpSuit === nextReveal.trumpSuit;
  }

  function canTwistByPlayer({ playerIndex, reveal, lastTwistPlayer, lastTwistReveal }) {
    if (lastTwistPlayer === null || lastTwistPlayer === undefined) {
      return true;
    }
    if (lastTwistPlayer !== playerIndex) return true;
    return isOneWangUpgrade(lastTwistReveal, reveal);
  }

  function findRevealsForHand(hand, level, options = {}) {
    const { requireSameColor = false, allowDoubleJokers = true } = options;
    const reveals = [];
    const bigJokers = hand.filter(card => isBigJoker(card));
    const smallJokers = hand.filter(card => isSmallJoker(card));
    const levelBySuit = {};

    hand.forEach(card => {
      if (card.rank !== level) return;
      if (!levelBySuit[card.suit]) {
        levelBySuit[card.suit] = [];
      }
      levelBySuit[card.suit].push(card);
    });

    if (allowDoubleJokers && bigJokers.length >= 2) {
      reveals.push({
        cards: [bigJokers[0], bigJokers[1]],
        reveal: analyzeReveal([bigJokers[0], bigJokers[1]], level, {
          requireSameColor,
          allowDoubleJokers
        })
      });
    }

    if (allowDoubleJokers && smallJokers.length >= 2) {
      reveals.push({
        cards: [smallJokers[0], smallJokers[1]],
        reveal: analyzeReveal([smallJokers[0], smallJokers[1]], level, {
          requireSameColor,
          allowDoubleJokers
        })
      });
    }

    const jokers = [...bigJokers, ...smallJokers];
    jokers.forEach(joker => {
      const singleReveal = analyzeReveal([joker], level, {
        requireSameColor,
        allowDoubleJokers
      });
      if (singleReveal) {
        reveals.push({ cards: [joker], reveal: singleReveal });
      }

      Object.keys(levelBySuit).forEach(suit => {
        const levels = levelBySuit[suit];
        if (!levels.length) return;
        if (requireSameColor && !jokerMatchesSuit(joker, suit)) return;
        const singleCards = [joker, levels[0]];
        reveals.push({
          cards: singleCards,
          reveal: analyzeReveal(singleCards, level, {
            requireSameColor,
            allowDoubleJokers
          })
        });
        if (levels.length >= 2) {
          const doubleCards = [joker, levels[0], levels[1]];
          reveals.push({
            cards: doubleCards,
            reveal: analyzeReveal(doubleCards, level, {
              requireSameColor,
              allowDoubleJokers
            })
          });
        }
      });
    });

    return reveals;
  }

  function getFirstRoundRevealForSuit(hand, level, suit, options = {}) {
    const { requireSameColor = true, allowDoubleJokers = false } = options;
    if (!suit || suit === "BJ" || suit === "SJ") return null;
    const joker = hand.find(card => jokerMatchesSuit(card, suit));
    if (!joker) return null;
    const levels = hand.filter(card => card.rank === level && card.suit === suit);
    if (!levels.length) return null;
    if (levels.length >= 2) {
      const doubleCards = [joker, levels[0], levels[1]];
      const doubleReveal = analyzeReveal(doubleCards, level, {
        requireSameColor,
        allowDoubleJokers
      });
      if (doubleReveal) {
        return { reveal: doubleReveal, cards: doubleCards };
      }
    }
    const singleCards = [joker, levels[0]];
    const singleReveal = analyzeReveal(singleCards, level, {
      requireSameColor,
      allowDoubleJokers
    });
    if (!singleReveal) return null;
    return { reveal: singleReveal, cards: singleCards };
  }

  function aiRevealAllowed(candidate, options = {}) {
    if (!candidate?.reveal || !candidate.cards?.length) return false;
    const { requireSameColor } = options;
    const { trumpSuit } = candidate.reveal;
    if (trumpSuit) {
      const joker = candidate.cards.find(card => card.suit === "JOKER");
      if (!joker) return false;
      if (requireSameColor && !jokerMatchesSuit(joker, trumpSuit)) {
        return false;
      }
      return true;
    }
    if (candidate.reveal.type === "SINGLE_JOKER") {
      return true;
    }
    const jokers = candidate.cards.filter(card => card.suit === "JOKER");
    if (jokers.length < 2) return false;
    const allBig = jokers.every(card => isBigJoker(card));
    const allSmall = jokers.every(card => isSmallJoker(card));
    return allBig || allSmall;
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

  window.TrumpUtils = {
    aiRevealAllowed,
    canTwistByPlayer,
    findRevealsForHand,
    getFirstRoundRevealForSuit,
    isBigJoker,
    isRedSuit,
    isSmallJoker,
    isSuitKey,
    jokerMatchesSuit
  };

})();
