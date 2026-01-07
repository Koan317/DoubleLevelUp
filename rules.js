// rules.js

(function () {

  const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];

  function isTrump(card, state) {
    if (card.suit === "JOKER") return true;
    if (card.rank === state.level) return true;
    if (card.suit === state.trumpSuit) return true;
    return false;
  }

  function rankValue(rank) {
    return RANKS.indexOf(rank);
  }

  function cardPower(card, state) {
    // 王
    if (card.suit === "JOKER") {
      return card.rank === "大王" ? 100 : 90;
    }

    // 主牌
    if (isTrump(card, state)) {
      if (card.rank === state.level) return 80;
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
