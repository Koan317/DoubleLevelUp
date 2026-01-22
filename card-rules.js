// card-rules.js

(function () {

  const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
  const RANK_VALUE = Object.create(null);

  for (let i = 0; i < RANKS.length; i++) {
    RANK_VALUE[RANKS[i]] = i;
  }

  function isTrump(card, state) {
    if (card.suit === "JOKER") return true;
    if (state.level === "王") return false;
    if (card.rank === state.level) return true;
    if (card.suit === state.trumpSuit) return true;
    return false;
  }

  function rankValue(rank) {
    return RANK_VALUE[rank] ?? -1;
  }

  function cardPower(card, state) {
    // 王
    if (card.suit === "JOKER") {
      return card.rank === "BJ" ? 100 : 90;
    }

    // 主牌
    if (isTrump(card, state)) {
      if (card.rank === state.level) {
        if (card.suit === state.trumpSuit) return 85;
        return 80;
      }
      return 60 + rankValue(card.rank);
    }

    // 副牌
    return rankValue(card.rank);
  }

  window.Rules = {
    isTrump,
    rankValue,
    cardPower
  };

})();
