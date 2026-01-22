// play-patterns.js

(function () {

  const BASE_ORDER = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
  const ORDER_CACHE = Object.create(null);
  const BASE_RANK_INDEX = Object.create(null);
  BASE_ORDER.forEach((rank, index) => {
    BASE_RANK_INDEX[rank] = index;
  });

  function normalizeTrumpInfo(trumpInfoOrLevel) {
    if (typeof trumpInfoOrLevel === "string") {
      return { level: trumpInfoOrLevel, trumpSuit: null };
    }
    return trumpInfoOrLevel ?? { level: null, trumpSuit: null };
  }

  function resolveSuitType(trumpInfo, options = {}) {
    if (options.suitType) {
      return options.suitType === "trump" ? "trump" : "side";
    }
    if (options.suit === "JOKER") return "trump";
    if (options.suit && options.suit === trumpInfo.trumpSuit) return "trump";
    return "side";
  }

  function getSequenceOrder(trumpInfo, suitType = "trump") {
    if (suitType === "side") return BASE_ORDER;
    const key = `${suitType}|${trumpInfo?.level ?? ""}`;
    if (!ORDER_CACHE[key]) {
      ORDER_CACHE[key] = BASE_ORDER.filter(r => r !== trumpInfo.level);
    }
    return ORDER_CACHE[key];
  }

  function isJokerTractorRanks(pairRanks) {
    if (pairRanks.length !== 2) return false;
    const ranks = pairRanks.map(pair => pair.rank).sort();
    return ranks[0] === "BJ" && ranks[1] === "SJ";
  }

  // 识别拖拉机
  function detectTractors(pairs, trumpInfoOrLevel, options = {}) {
    if (pairs.length < 2) return [];

    const trumpInfo = normalizeTrumpInfo(trumpInfoOrLevel);
    const suitType = resolveSuitType(trumpInfo, options);

    if (options.suit === "JOKER") {
      const byRank = Object.fromEntries(pairs.map(pair => [pair.rank, pair]));
      if (byRank.BJ && byRank.SJ) {
        return [[byRank.SJ, byRank.BJ]];
      }
      return [];
    }

    const order = getSequenceOrder(trumpInfo, suitType);
    const rankIndex = Object.create(null);
    order.forEach((rank, index) => {
      rankIndex[rank] = index;
    });
    const sorted = pairs
      .map(pair => ({
        pair,
        idx: rankIndex[pair.rank] ?? -1
      }))
      .filter(item => item.idx >= 0)
      .sort((a, b) => a.idx - b.idx)
      .map(item => item.pair);

    if (sorted.length < 2) return [];

    const tractors = [];
    let current = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const prev = current[current.length - 1];
      if (rankIndex[prev.rank] + 1 === rankIndex[sorted[i].rank]) {
        current.push(sorted[i]);
      } else {
        if (current.length >= 2) tractors.push(current);
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
      card: c,
      isTrump: Rules.isTrump(c, trumpInfo),
      normRank: normalizeRank(c),
      power: Rules.cardPower(c, trumpInfo)
    }));

    const allTrump = mapped.every(c => c.isTrump);
    const nonJokers = mapped.filter(c => c.suit !== "JOKER");
    const nonJokerSuit = nonJokers[0]?.suit ?? null;
    const sameNonJokerSuit = nonJokers.every(c => c.suit === nonJokerSuit);
    const hasJoker = mapped.length !== nonJokers.length;

    let suitType;
    let suit;
    let isMixedSuit;

    if (allTrump) {
      suitType = "trump";
      suit = null;
      isMixedSuit = false;
    } else if (sameNonJokerSuit && !hasJoker) {
      suitType = "side";
      suit = nonJokerSuit;
      isMixedSuit = false;
    } else {
      suitType = "side";
      suit = nonJokerSuit;
      isMixedSuit = true;
    }

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
    } else if (isTractor(groups, trumpInfo, suitType)) {
      type = "tractor";
    } else {
      type = "throw";
    }

    if (isMixedSuit && cards.length > 1) {
      type = "throw";
    }

    const rankPowers = getRankPowers(groups);
    const mainRank = getMainRank(ranks, rankPowers);
    const isJokerTractor = type === "tractor" && mapped.every(c => c.suit === "JOKER") &&
      isJokerTractorRanks(ranks.map(parseGroupKey));

    return {
      type,
      length: cards.length,

      suitType,
      suit,
      isTrump: suitType === "trump",
      isMixedSuit,
      isJokerTractor,

      mainRank,
      power: rankPowers[mainRank] ?? 0,
      compareValue: rankPowers[mainRank] ?? 0,
      cards
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
        return (BASE_RANK_INDEX[bRank] ?? -1) - (BASE_RANK_INDEX[aRank] ?? -1);
      })[0];
  }

  function isTractor(groups, trumpInfo, suitType) {
    const pairRanks = Object.keys(groups)
      .filter(r => groups[r].length === 2)
      .map(r => parseGroupKey(r));

    if (pairRanks.length < 2) return false;

    const suits = new Set(pairRanks.map(r => r.suit));
    if (suits.size !== 1) return false;

    const suit = pairRanks[0].suit;
    if (suit === "JOKER") return isJokerTractorRanks(pairRanks);

    const order = getSequenceOrder(trumpInfo, suitType);
    const rankIndex = Object.create(null);
    order.forEach((rank, index) => {
      rankIndex[rank] = index;
    });
    const idxs = pairRanks
      .map(r => rankIndex[r.rank] ?? -1)
      .sort((a,b)=>a-b);

    if (idxs.some(i => i < 0)) return false;

    for (let i = 1; i < idxs.length; i++) {
      if (idxs[i] !== idxs[i-1] + 1) return false;
    }
    return true;
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
