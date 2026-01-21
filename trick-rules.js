// trick-rules.js
// 非 module

(function () {

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

    const followPattern = Pattern.analyzePlay(followCards, trumpInfo);

    const matchingCards = handCards.filter(card => {
      if (leadPattern.suitType === "trump") {
        return Rules.isTrump(card, trumpInfo);
      }
      return !Rules.isTrump(card, trumpInfo) && card.suit === leadPattern.suit;
    });
    const matchingCount = matchingCards.length;

    // 2️⃣ 有同花色且数量足够 → 禁止出其他花色
    if (matchingCount >= leadPattern.length) {
      const allMatchSuit = followCards.every(card => {
        if (leadPattern.suitType === "trump") {
          return Rules.isTrump(card, trumpInfo);
        }
        return !Rules.isTrump(card, trumpInfo) && card.suit === leadPattern.suit;
      });
      if (!allMatchSuit) {
        return illegal("有同花色必须全跟");
      }
    }

    // 3️⃣ 有同花色但数量不足 → 必须出完同花色再贴牌
    if (matchingCount > 0 && matchingCount < leadPattern.length) {
      const hasAllMatching = matchingCards.every(card => followCards.includes(card));
      if (!hasAllMatching) {
        return illegal("同花色未尽最大义务");
      }
    }

    // 4️⃣ 对子义务（仅在同花色数量足够时）
    if (matchingCount >= leadPattern.length &&
        leadPattern.type === "pair" &&
        hasPairToFollow(leadPattern, handCards, trumpInfo)) {
      if (followPattern.type !== "pair") {
        return illegal("有对子未跟对子");
      }
    }

    // 5️⃣ 拖拉机义务（仅在同花色数量足够时）
    if (matchingCount >= leadPattern.length &&
        leadPattern.type === "tractor" &&
        hasTractorToFollow(leadPattern, handCards, trumpInfo)) {

      if (followPattern.type !== "tractor") {
        return illegal("有拖拉机未跟拖拉机");
      }

      if (followPattern.length < leadPattern.length) {
        return illegal("拖拉机长度不足");
      }
    } else if (matchingCount >= leadPattern.length &&
        leadPattern.type === "tractor") {
      const requiredPairs = Math.floor(leadPattern.length / 2);
      const availablePairs = countPairsToFollow(leadPattern, matchingCards, trumpInfo);
      if (availablePairs > 0) {
        const followPairs = countPairsToFollow(leadPattern, followCards, trumpInfo);
        const expectedPairs = Math.min(requiredPairs, availablePairs);
        if (followPairs < expectedPairs) {
          return illegal("无拖拉机需按数量跟对");
        }
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

  function compareTrickPlays(plays, trumpInfo) {
    // plays: [{ player, cards, pattern }]
    const leadPattern = plays[0].pattern;

    let winner = plays[0];

    for (let i = 1; i < plays.length; i++) {
      if (beats(plays[i], winner, leadPattern)) {
        winner = plays[i];
      }
    }

    return winner.player;
  }

  function beats(a, b, leadPattern) {
    const pa = a.pattern;
    const pb = b.pattern;

    const aIsLead = pa === leadPattern;
    const bIsLead = pb === leadPattern;

    // 0️⃣ 贴牌（混合花色）一律算小（非首家）
    const aMixed = !aIsLead && pa.isMixedSuit;
    const bMixed = !bIsLead && pb.isMixedSuit;
    if (aMixed !== bMixed) return !aMixed;
    if (aMixed && bMixed) return false;

    // 拖拉机：非首家未跟花色/主牌则必小
    if (leadPattern.type === "tractor") {
      if (!aIsLead && !sameSuitType(pa, leadPattern)) return false;
      if (!bIsLead && !sameSuitType(pb, leadPattern)) return true;
    }

    // 1️⃣ 贴牌（未按首家牌型跟）一律算小
    if (leadPattern.type !== "throw") {
      const aMatchesLead = pa.type === leadPattern.type;
      const bMatchesLead = pb.type === leadPattern.type;
      if (aMatchesLead && !bMatchesLead) return true;
      if (!aMatchesLead && bMatchesLead) return false;
    }

    // 2️⃣ 主压副
    if (pa.suitType === "trump" && pb.suitType !== "trump") return true;
    if (pa.suitType !== "trump" && pb.suitType === "trump") return false;

    // 3️⃣ 副牌必须跟首家花色
    if (pa.suitType === "side" && pb.suitType === "side") {
      const aFollow = pa.suit === leadPattern.suit;
      const bFollow = pb.suit === leadPattern.suit;

      if (aFollow && !bFollow) return true;
      if (!aFollow && bFollow) return false;
    }

    // 4️⃣ 同类型比大小
    return pa.power > pb.power;
  }

  /* ================= 跟牌工具 ================= */

  function sameSuitType(a, b) {
    if (a.suitType !== b.suitType) return false;
    if (a.suitType === "trump") return true;
    return a.suit === b.suit;
  }

  function hasSuitToFollow(leadPattern, handCards, trumpInfo) {
    return handCards.some(c => {
      const p = Pattern.analyzePlay([c], trumpInfo);
      if (leadPattern.suitType === "trump") {
        return p.isTrump;
      }
      return !p.isTrump && p.suit === leadPattern.suit;
    });
  }

  function hasPairToFollow(leadPattern, handCards, trumpInfo) {
    const map = {};
    for (const c of handCards) {
      const p = Pattern.analyzePlay([c], trumpInfo);
      if (!sameSuitType(p, leadPattern)) continue;
      const key = p.mainRank;
      map[key] = (map[key] || 0) + 1;
      if (map[key] >= 2) return true;
    }
    return false;
  }

  function countPairsToFollow(leadPattern, cards, trumpInfo) {
    const map = {};
    for (const c of cards) {
      const p = Pattern.analyzePlay([c], trumpInfo);
      if (!sameSuitType(p, leadPattern)) continue;
      const key = p.mainRank;
      map[key] = (map[key] || 0) + 1;
    }
    return Object.values(map).reduce((sum, count) => sum + Math.floor(count / 2), 0);
  }

  function hasTractorToFollow(leadPattern, handCards, trumpInfo) {
    if (leadPattern.isJokerTractor) {
      const jokerCounts = handCards.reduce((acc, card) => {
        if (card.suit === "JOKER") {
          acc[card.rank] = (acc[card.rank] || 0) + 1;
        }
        return acc;
      }, {});
      return (jokerCounts.BJ ?? 0) >= 2 && (jokerCounts.SJ ?? 0) >= 2;
    }

    const ranks = [];

    for (const c of handCards) {
      const p = Pattern.analyzePlay([c], trumpInfo);
      if (!sameSuitType(p, leadPattern)) continue;
      ranks.push(parseGroupKey(p.mainRank).rank);
    }

    const count = {};
    ranks.forEach(r => count[r] = (count[r] || 0) + 1);

    const order = Pattern.getSequenceOrder(trumpInfo, leadPattern.suitType);
    const pairs = Object.keys(count)
      .filter(r => count[r] >= 2)
      .map(r => order.indexOf(r))
      .filter(i => i >= 0)
      .sort((a,b)=>a-b);

    let max = 1, cur = 1;
    for (let i=1;i<pairs.length;i++) {
      if (pairs[i] === pairs[i-1] + 1) {
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

  function checkThrowMaximality(leadCards, otherHands, trumpInfo) {
    const leadPattern = Pattern.analyzePlay(leadCards, trumpInfo);
    if (leadPattern.type !== "throw") {
      return { ok: true };
    }

    const components = splitThrowComponents(leadCards, trumpInfo);
    if (components.length === 0) {
      return { ok: true };
    }

    for (let i = 0; i < otherHands.length; i++) {
      const hand = otherHands[i];
      for (const component of components) {
        if (handCanBeatComponent(component, hand, trumpInfo, leadPattern)) {
          return {
            ok: false,
            reason: "甩牌未保证最大性",
            component,
            playerIndex: i
          };
        }
      }
    }

    return { ok: true };
  }

  function getSmallestThrowComponent(leadCards, trumpInfo) {
    const components = splitThrowComponents(leadCards, trumpInfo);
    if (!components.length) return null;

    return components.reduce((min, current) => {
      if (!min) return current;
      if (current.power !== min.power) {
        return current.power < min.power ? current : min;
      }
      if (current.length !== min.length) {
        return current.length < min.length ? current : min;
      }
      return current;
    }, null);
  }

  function splitThrowComponents(cards, trumpInfo) {
    const leadPattern = Pattern.analyzePlay(cards, trumpInfo);
    if (leadPattern.type !== "throw") return [];

    const groups = buildCardGroups(cards);
    const components = [];
    const pairsBySuit = new Map();

    groups.forEach((groupCards, key) => {
      if (groupCards.length < 2) return;
      const { suit, rank } = parseGroupKey(key);
      if (!pairsBySuit.has(suit)) {
        pairsBySuit.set(suit, []);
      }
      pairsBySuit.get(suit).push(rank);
    });

    pairsBySuit.forEach((ranks, suit) => {
      const tractors = Tractor.detectTractors(
        ranks.map(rank => ({ rank })),
        trumpInfo,
        { suit }
      );
      tractors.forEach(sequence => {
        const tractorCards = [];
        sequence.forEach(({ rank }) => {
          const key = `${suit}-${rank}`;
          const group = groups.get(key);
          if (!group || group.length < 2) return;
          tractorCards.push(group.pop(), group.pop());
        });
        if (tractorCards.length) {
          components.push(buildComponent(tractorCards, trumpInfo));
        }
      });
    });

    groups.forEach(groupCards => {
      while (groupCards.length >= 2) {
        const pairCards = groupCards.splice(0, 2);
        components.push(buildComponent(pairCards, trumpInfo));
      }
    });

    groups.forEach(groupCards => {
      groupCards.forEach(card => {
        components.push(buildComponent([card], trumpInfo));
      });
      groupCards.length = 0;
    });

    return components;
  }

  function handCanBeatComponent(component, handCards, trumpInfo, leadPattern) {
    const leadSuitType = leadPattern.suitType;
    const leadSuit = leadPattern.suit;
    const candidates = handCards.filter(card => {
      if (leadSuitType === "trump") {
        return Rules.isTrump(card, trumpInfo);
      }
      return !Rules.isTrump(card, trumpInfo) && card.suit === leadSuit;
    });

    if (component.type === "single") {
      return candidates.some(card => {
        const p = Pattern.analyzePlay([card], trumpInfo);
        return p.power > component.power;
      });
    }

    if (component.type === "pair") {
      const groups = buildCardGroups(candidates);
      for (const groupCards of groups.values()) {
        if (groupCards.length >= 2) {
          const p = Pattern.analyzePlay(groupCards.slice(0, 2), trumpInfo);
          if (p.power > component.power) {
            return true;
          }
        }
      }
      return false;
    }

    if (component.type === "tractor") {
      const groups = buildCardGroups(candidates);
      const pairsBySuit = new Map();
      groups.forEach((groupCards, key) => {
        if (groupCards.length < 2) return;
        const { suit, rank } = parseGroupKey(key);
        if (!pairsBySuit.has(suit)) {
          pairsBySuit.set(suit, []);
        }
        pairsBySuit.get(suit).push(rank);
      });

      for (const [suit, ranks] of pairsBySuit.entries()) {
        const tractors = Tractor.detectTractors(
          ranks.map(rank => ({ rank })),
          trumpInfo,
          { suit }
        );
        for (const sequence of tractors) {
          if (sequence.length * 2 !== component.length) continue;
          const power = maxSequencePower(sequence, suit, groups, trumpInfo);
          if (power > component.power) {
            return true;
          }
        }
      }
    }

    return false;
  }

  function maxSequencePower(sequence, suit, groups, trumpInfo) {
    let max = -Infinity;
    sequence.forEach(({ rank }) => {
      const key = `${suit}-${rank}`;
      const groupCards = groups.get(key);
      if (!groupCards || groupCards.length === 0) return;
      const power = Rules.cardPower(groupCards[0], trumpInfo);
      if (power > max) max = power;
    });
    return max;
  }

  function buildComponent(cards, trumpInfo) {
    const pattern = Pattern.analyzePlay(cards, trumpInfo);
    return {
      type: pattern.type,
      length: pattern.length,
      power: pattern.power,
      cards
    };
  }

  function buildCardGroups(cards) {
    const groups = new Map();
    cards.forEach(card => {
      const key = buildGroupKey(card);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(card);
    });
    return groups;
  }

  function buildGroupKey(card) {
    return `${card.suit}-${normalizeRank(card)}`;
  }

  function parseGroupKey(key) {
    const [suit, rank] = key.split("-");
    return { suit, rank };
  }

  function normalizeRank(card) {
    if (card.suit === "JOKER") {
      return card.rank === "BJ" ? "BJ" : "SJ";
    }
    return card.rank;
  }

  function illegal(reason) {
    return { ok: false, reason };
  }

  function legal(pattern) {
    return { ok: true, pattern };
  }

  window.Compare = {
    compareTrickPlays
  };

  window.Follow = {
    validateFollowPlay
  };

  window.Throw = {
    checkThrowMaximality,
    getSmallestThrowComponent
  };

})();
