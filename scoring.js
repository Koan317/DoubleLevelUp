// scoring.js

(function () {

  function cardScore(card) {
    if (card.rank === "5") return 5;
    if (card.rank === "10" || card.rank === "K") return 10;
    return 0;
  }

  function totalBottomScore(cards) {
    return cards.reduce((s, c) => s + cardScore(c), 0);
  }

  function totalTrickScore(cards) {
    return cards.reduce((s, c) => s + cardScore(c), 0);
  }

  /**
   * 根据“最后一回合赢家出的牌型”算倍率
   */
  function calcMultiplierByWinningPlay(pattern, level) {
    // 普通牌型
    if (pattern.type === "single") return 1;
    if (pattern.type === "pair") return 2;
    if (pattern.type === "tractor") {
      return Math.pow(2, pattern.length / 2);
    }

    // 甩牌
    if (pattern.type === "throw") {
      const ranks = pattern.cards.map(c => c.rank);

      // 统计对子
      const cnt = {};
      ranks.forEach(r => cnt[r] = (cnt[r] || 0) + 1);
      const pairRanks = Object.keys(cnt).filter(r => cnt[r] >= 2);

      if (pairRanks.length === 0) return 1;

      // 判断拖拉机
      const tractors = Tractor.detectTractors(
        pairRanks.map(r => ({ rank: r })),
        level
      );

      if (!tractors.length) return 2;

      const maxPairs = Math.max(...tractors.map(t => t.length));
      return Math.pow(2, maxPairs);
    }

    return 1;
  }

  /**
   * 抠底结算
   */
  function settleBottom({
    bottomCards,
    lastTrickWinnerIsScorer,
    winningPattern,
    level
  }) {
    if (!lastTrickWinnerIsScorer) return 0;

    const base = totalBottomScore(bottomCards);
    const mult = calcMultiplierByWinningPlay(winningPattern, level);
    return base * mult;
  }

  window.Bottom = {
    settleBottom,
    calcMultiplierByWinningPlay
  };

  window.Score = {
    cardScore,
    totalTrickScore
  };

})();
