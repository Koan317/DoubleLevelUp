// tractor.js
// 非 module

(function () {

  const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];

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

  window.Tractor = {
    detectTractors
  };

})();
