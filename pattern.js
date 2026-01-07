// pattern.js

(function () {

  const BASE_ORDER = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];

  function analyzePlay(cards, trumpInfo) {
    if (!cards || cards.length === 0) {
      throw new Error("Empty play");
    }

    const mapped = cards.map(c => ({
      ...c,
      isTrump: isTrumpCard(c, trumpInfo),
      normRank: normalizeRank(c)
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

    const mainRank = getMainRank(ranks, trumpInfo);

    return {
      type,
      length: cards.length,

      suitType,
      suit,
      isTrump: suitType === "trump",

      mainRank,
      power: rankPower(mainRank, trumpInfo)
    };
  }

  /* ---------- 工具 ---------- */

  function normalizeRank(c) {
    if (c.suit === "JOKER") {
      return c.rank === "大王" ? "BJ" : "SJ";
    }
    return c.rank;
  }

  function isTrumpCard(c, trumpInfo) {
    if (c.suit === "JOKER") return true;
    if (c.rank === trumpInfo.level) return true;
    if (c.suit === trumpInfo.trumpSuit) return true;
    return false;
  }

  function rankPower(rank, trumpInfo) {
    if (rank === "BJ") return 100;
    if (rank === "SJ") return 90;
    if (rank === trumpInfo.level) return 80;
    return BASE_ORDER.indexOf(rank);
  }

  function getMainRank(ranks, trumpInfo) {
    return ranks
      .slice()
      .sort((a, b) => rankPower(b, trumpInfo) - rankPower(a, trumpInfo))[0];
  }

  function isTractor(groups, trumpInfo) {
    const pairRanks = Object.keys(groups)
      .filter(r => groups[r].length === 2);

    if (pairRanks.length < 2) return false;

    const order = getSequenceOrder(trumpInfo);
    const idxs = pairRanks
      .map(r => order.indexOf(r))
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
    analyzePlay
  };

})();
