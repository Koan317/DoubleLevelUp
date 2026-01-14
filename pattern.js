// pattern.js

(function () {

  const BASE_ORDER = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];

  function analyzePlay(cards, trumpInfo) {
    if (!cards || cards.length === 0) {
      throw new Error("Empty play");
    }

    const mapped = cards.map(c => ({
      ...c,
      isTrump: Rules.isTrump(c, trumpInfo),
      normRank: normalizeRank(c),
      power: Rules.cardPower(c, trumpInfo)
    }));

    const suitType = mapped.every(c => c.isTrump) ? "trump" : "side";
    const suit = suitType === "side" ? mapped[0].suit : null;

    // 分组（按 normRank）
    const groups = {};
    for (const c of mapped) {
      groups[c.normRank] ??= [];
      groups[c.normRank].push(c);
    }

    const ranks = Object.keys(groups);
    const counts = ranks.map(r => groups[r].length);

    let type;
    if (cards.length === 1) {
      type = "single";
    } else if (cards.length === 2 && counts[0] === 2) {
      type = "pair";
    } else if (isTractor(groups, trumpInfo)) {
      type = "tractor";
    } else {
      type = "throw";
    }

    const rankPowers = getRankPowers(groups, trumpInfo);
    const mainRank = getMainRank(ranks, rankPowers);

    return {
      type,
      length: cards.length,

      suitType,
      suit,
      isTrump: suitType === "trump",

      mainRank,
      power: rankPowers[mainRank] ?? 0,
      compareValue: rankPowers[mainRank] ?? 0
    };
  }

  /* ---------- 工具 ---------- */

  function normalizeRank(c) {
    if (c.suit === "JOKER") {
      return c.rank === "BJ" ? "BJ" : "SJ";
    }
    return c.rank;
  }

  function getRankPowers(groups) {
    const powers = {};
    Object.keys(groups).forEach(rank => {
      powers[rank] = Math.max(...groups[rank].map(c => c.power));
    });
    return powers;
  }

  function getMainRank(ranks, rankPowers) {
    return ranks
      .slice()
      .sort((a, b) => {
        const powerDiff = (rankPowers[b] ?? 0) - (rankPowers[a] ?? 0);
        if (powerDiff !== 0) return powerDiff;
        return BASE_ORDER.indexOf(b) - BASE_ORDER.indexOf(a);
      })[0];
  }

  function isTractor(groups, trumpInfo) {
    const pairRanks = Object.keys(groups)
      .filter(r => groups[r].length === 2);

    if (pairRanks.length < 2) return false;

    const order = getSequenceOrder(trumpInfo);
    const idxs = pairRanks
      .map(r => order.indexOf(r))
      .filter(i => i >= 0)
      .sort((a,b)=>a-b);

    for (let i = 1; i < idxs.length; i++) {
      if (idxs[i] !== idxs[i-1] + 1) return false;
    }
    return true;
  }

  function getSequenceOrder(trumpInfo) {
    return BASE_ORDER.filter(r => r !== trumpInfo.level);
  }

  // 挂到全局
  window.Pattern = {
    analyzePlay,
    getSequenceOrder
  };

})();
