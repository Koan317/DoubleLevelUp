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

  function hasTractorToFollow(leadPattern, handCards, trumpInfo) {
    const ranks = [];

    for (const c of handCards) {
      const p = Pattern.analyzePlay([c], trumpInfo);
      if (!sameSuitType(p, leadPattern)) continue;
      ranks.push(p.mainRank);
    }

    const count = {};
    ranks.forEach(r => count[r] = (count[r] || 0) + 1);

    const order = Pattern.getSequenceOrder(trumpInfo);
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

})();
