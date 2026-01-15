// play-patterns.js

(function () {

  const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
  const BASE_ORDER = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];

  function rankIndex(rank) {
    return RANKS.indexOf(rank);
  }

  function nextRank(rank) {
    const i = rankIndex(rank);
    return RANKS[(i + 1) % RANKS.length];
  }

  // 判断两个对子是否连续（支持隔主）
  function isConsecutivePair(a, b, level) {
    if (nextRank(a.rank) === b.rank) return true;

    // 隔的是主
    if (nextRank(a.rank) === level) {
      return nextRank(level) === b.rank;
    }
    return false;
  }

  // 识别拖拉机
  function detectTractors(pairs, level) {
    if (pairs.length < 2) return [];

    const sorted = [...pairs].sort(
      (a, b) => rankIndex(a.rank) - rankIndex(b.rank)
    );

    const tractors = [];
    let current = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      if (isConsecutivePair(current[current.length - 1], sorted[i], level)) {
        current.push(sorted[i]);
      } else {
        if (current.length >= 2) tractors.push([...current]);
        current = [sorted[i]];
      }
    }

    if (current.length >= 2) tractors.push(current);
    return tractors;
  }

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

    // 分组（按花色+点数）
    const groups = {};
    for (const c of mapped) {
      const key = buildGroupKey(c);
      groups[key] ??= [];
      groups[key].push(c);
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

    const rankPowers = getRankPowers(groups);
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

  function buildGroupKey(card) {
    return `${card.suit}-${card.normRank}`;
  }

  function parseGroupKey(key) {
    const [suit, rank] = key.split("-");
    return { suit, rank };
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
        const aRank = parseGroupKey(a).rank;
        const bRank = parseGroupKey(b).rank;
        return BASE_ORDER.indexOf(bRank) - BASE_ORDER.indexOf(aRank);
      })[0];
  }

  function isTractor(groups, trumpInfo) {
    const pairRanks = Object.keys(groups)
      .filter(r => groups[r].length === 2)
      .map(r => parseGroupKey(r));

    if (pairRanks.length < 2) return false;

    const suits = new Set(pairRanks.map(r => r.suit));
    if (suits.size !== 1) return false;

    const order = getSequenceOrder(trumpInfo);
    const idxs = pairRanks
      .map(r => order.indexOf(r.rank))
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
  window.Tractor = {
    detectTractors
  };

  window.Pattern = {
    analyzePlay,
    getSequenceOrder
  };

})();
