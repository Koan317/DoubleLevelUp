// ai.js

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
    // 尝试找能压过首家的最小一张
    for (const item of analyzed) {
      if (beats(item.pattern, leadPattern, state)) {
        return [item.card];
      }
    }

    // 压不了 → 出最小（可能是贴牌）
    return [analyzed[0].card];
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

  return {
    aiPlay
  };

})();
