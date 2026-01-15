// ai-play.js

window.AI = (function () {

  /**
   * hand: Array<Card>
   * leadPattern: analyzePlay(...) | null
   * state: { level, trumpSuit }
   * role: "leader" | "follower"（暂不深度使用）
   */
  function aiPlay(hand, leadPattern, state, role) {
    // 单牌 AI：当前版本只出单
    // 后续可扩展对 / 拖拉机

    const analyzed = hand.map(card => ({
      card,
      pattern: Pattern.analyzePlay([card], state),
      isTrump: Rules.isTrump(card, state),
      power: Rules.cardPower(card, state)
    }));

    // 按“由小到大”排序
    analyzed.sort(compareCardAsc);

    // ========= 首家 =========
    if (!leadPattern) {
      // 优先出副牌里的最大牌
      const sideCards = analyzed.filter(p => !p.pattern.isTrump);
      if (sideCards.length > 0) {
        return [sideCards[sideCards.length - 1].card];
      }
      // 没副牌，只能出主，出最小主
      return [analyzed[0].card];
    }

    // ========= 跟牌 =========
    return pickLegalFollow(analyzed, hand, leadPattern, state);
  }

  /* ================= 工具函数 ================= */

  function compareCardAsc(a, b) {
    // trump > side
    if (a.pattern.isTrump && !b.pattern.isTrump) return 1;
    if (!a.pattern.isTrump && b.pattern.isTrump) return -1;

    return a.power - b.power;
  }

  function beats(myPattern, leadPattern, state) {
    // 主压副
    if (myPattern.isTrump && !leadPattern.isTrump) return true;
    if (!myPattern.isTrump && leadPattern.isTrump) return false;

    if (!myPattern.isTrump && !leadPattern.isTrump) {
      if (myPattern.suit !== leadPattern.suit) {
        return false;
      }
    }

    return myPattern.power > leadPattern.power;
  }

  function pickLegalFollow(analyzed, hand, leadPattern, state) {
    const needCount = leadPattern.length;

    if (needCount === 1) {
      const legalSingles = analyzed.filter(item =>
        isLegalFollow([item.card], leadPattern, hand, state)
      );

      if (!legalSingles.length) {
        return [analyzed[0].card];
      }

      for (const item of legalSingles) {
        if (beats(item.pattern, leadPattern, state)) {
          return [item.card];
        }
      }

      return [legalSingles[0].card];
    }

    const sortedCards = analyzed.map(item => item.card);
    const legalCombos = findLegalCombos(sortedCards, leadPattern, hand, state);

    if (!legalCombos.length) {
      return sortedCards.slice(0, needCount);
    }

    return legalCombos[0];
  }

  function findLegalFollow(hand, leadPattern, state) {
    if (!leadPattern) {
      return hand.length ? [hand[0]] : [];
    }
    const sortedCards = hand.slice();
    const legalCombos = findLegalCombos(sortedCards, leadPattern, hand, state);
    if (legalCombos.length) {
      return legalCombos[0];
    }
    return sortedCards.slice(0, leadPattern.length);
  }

  function findLegalCombos(sortedCards, leadPattern, hand, state) {
    const needCount = leadPattern.length;
    const result = [];

    function search(start, combo) {
      if (combo.length === needCount) {
        if (isLegalFollow(combo, leadPattern, hand, state)) {
          result.push(combo.slice());
        }
        return;
      }
      for (let i = start; i <= sortedCards.length - (needCount - combo.length); i++) {
        combo.push(sortedCards[i]);
        search(i + 1, combo);
        combo.pop();
      }
    }

    search(0, []);
    return result;
  }

  function isLegalFollow(cards, leadPattern, hand, state) {
    const check = Follow.validateFollowPlay({
      leadPattern,
      followCards: cards,
      handCards: hand,
      trumpInfo: state
    });
    return check.ok;
  }

  return {
    aiPlay,
    findLegalFollow
  };

})();
