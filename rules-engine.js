// rules-engine.js

(function () {
  const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  const BASE_ORDER = [...RANKS];

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
      return card.rank === "BJ" ? 100 : 90;
    }

    // 主牌
    if (isTrump(card, state)) {
      if (card.rank === state.level) return 80;
      return 60 + rankValue(card.rank);
    }

    // 副牌
    return rankValue(card.rank);
  }

  function analyzePlay(cards, trumpInfo) {
    if (!cards || cards.length === 0) {
      throw new Error("Empty play");
    }

    const mapped = cards.map(c => ({
      ...c,
      isTrump: isTrump(c, trumpInfo),
      normRank: normalizeRank(c),
      power: cardPower(c, trumpInfo)
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

  function compareTrickPlays(plays) {
    // plays: [{ player, cards, pattern }]
    const leadPattern = plays[0].pattern;

    let winner = plays[0];

    for (let i = 1; i < plays.length; i++) {
      if (beatsTrickPlay(plays[i], winner, leadPattern)) {
        winner = plays[i];
      }
    }

    return winner.player;
  }

  function validateFollowPlay({
    leadPattern,
    followCards,
    handCards,
    trumpInfo
  }) {
    // 1️⃣ 张数必须一致
    if (followCards.length !== leadPattern.length) {
      return illegal("出牌数量不一致");
    }

    const followPattern = analyzePlay(followCards, trumpInfo);

    // 2️⃣ 是否有“跟的能力”
    const canFollowSuit = hasSuitToFollow(leadPattern, handCards, trumpInfo);

    // 3️⃣ 有能力却没跟 → 非法
    if (canFollowSuit && !sameSuitType(leadPattern, followPattern)) {
      return illegal("未按要求跟主/副");
    }

    // 4️⃣ 对子义务
    if (leadPattern.type === "pair" &&
        hasPairToFollow(leadPattern, handCards, trumpInfo)) {
      if (followPattern.type !== "pair") {
        return illegal("有对子未跟对子");
      }
    }

    // 5️⃣ 拖拉机义务
    if (leadPattern.type === "tractor" &&
        hasTractorToFollow(leadPattern, handCards, trumpInfo)) {

      if (followPattern.type !== "tractor") {
        return illegal("有拖拉机未跟拖拉机");
      }

      if (followPattern.length < leadPattern.length) {
        return illegal("拖拉机长度不足");
      }
    }

    // 6️⃣ 甩牌：只要求“尽最大义务”
    if (leadPattern.type === "throw") {
      if (!canSatisfyThrow(leadPattern, followPattern, handCards, trumpInfo)) {
        return illegal("甩牌未尽到最大义务");
      }
    }

    return legal(followPattern);
  }

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
      .sort((a, b) => a - b);

    for (let i = 1; i < idxs.length; i++) {
      if (idxs[i] !== idxs[i - 1] + 1) return false;
    }
    return true;
  }

  function getSequenceOrder(trumpInfo) {
    return BASE_ORDER.filter(r => r !== trumpInfo.level);
  }

  function beatsTrickPlay(a, b, leadPattern) {
    const pa = a.pattern;
    const pb = b.pattern;

    // 1️⃣ 主压副
    if (pa.suitType === "trump" && pb.suitType !== "trump") return true;
    if (pa.suitType !== "trump" && pb.suitType === "trump") return false;

    // 2️⃣ 副牌必须跟首家花色
    if (pa.suitType === "side" && pb.suitType === "side") {
      const aFollow = pa.suit === leadPattern.suit;
      const bFollow = pb.suit === leadPattern.suit;

      if (aFollow && !bFollow) return true;
      if (!aFollow && bFollow) return false;
    }

    // 3️⃣ 同类型比大小
    return pa.power > pb.power;
  }

  function sameSuitType(a, b) {
    if (a.suitType !== b.suitType) return false;
    if (a.suitType === "trump") return true;
    return a.suit === b.suit;
  }

  function hasSuitToFollow(leadPattern, handCards, trumpInfo) {
    return handCards.some(c => {
      const p = analyzePlay([c], trumpInfo);
      if (leadPattern.suitType === "trump") {
        return p.isTrump;
      }
      return !p.isTrump && p.suit === leadPattern.suit;
    });
  }

  function hasPairToFollow(leadPattern, handCards, trumpInfo) {
    const map = {};
    for (const c of handCards) {
      const p = analyzePlay([c], trumpInfo);
      if (!sameSuitType(p, leadPattern)) continue;
      const key = p.mainRank;
      map[key] = (map[key] || 0) + 1;
      if (map[key] >= 2) return true;
    }
    return false;
  }

  function hasTractorToFollow(leadPattern, handCards, trumpInfo) {
    const ranks = [];

    for (const c of handCards) {
      const p = analyzePlay([c], trumpInfo);
      if (!sameSuitType(p, leadPattern)) continue;
      ranks.push(p.mainRank);
    }

    const count = {};
    ranks.forEach(r => count[r] = (count[r] || 0) + 1);

    const order = getSequenceOrder(trumpInfo);
    const pairs = Object.keys(count)
      .filter(r => count[r] >= 2)
      .map(r => order.indexOf(r))
      .filter(i => i >= 0)
      .sort((a, b) => a - b);

    let max = 1;
    let cur = 1;
    for (let i = 1; i < pairs.length; i++) {
      if (pairs[i] === pairs[i - 1] + 1) {
        cur++;
        max = Math.max(max, cur);
      } else {
        cur = 1;
      }
    }

    return max * 2 >= leadPattern.length;
  }

  function canSatisfyThrow(lead, follow, handCards, trumpInfo) {
    // 简化规则：只校验 suitType 是否一致即可
    if (lead.suitType === "trump") {
      return !hasSuitToFollow(lead, handCards, trumpInfo) ||
             follow.suitType === "trump";
    }
    return !hasSuitToFollow(lead, handCards, trumpInfo) ||
           follow.suit === lead.suit;
  }

  function illegal(reason) {
    return { ok: false, reason };
  }

  function legal(pattern) {
    return { ok: true, pattern };
  }

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

  window.Rules = {
    isTrump,
    rankValue,
    cardPower
  };

  window.Pattern = {
    analyzePlay,
    getSequenceOrder
  };

  window.Tractor = {
    detectTractors
  };

  window.Compare = {
    compareTrickPlays
  };

  window.Follow = {
    validateFollowPlay
  };
})();
