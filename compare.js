// compare.js
// 非 module

(function () {

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

  window.Compare = {
    compareTrickPlays
  };

})();
