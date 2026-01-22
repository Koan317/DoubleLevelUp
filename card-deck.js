// card-deck.js

window.Cards = (function () {

  const SUITS = Object.freeze(["♠", "♥", "♦", "♣"]);
  const RANKS = Object.freeze(["2","3","4","5","6","7","8","9","10","J","Q","K","A"]);

  /**
   * 创建 2 副完整扑克牌（108 张）
   * 小王 / 大王不区分花色
   */
  function createDeck() {
    const singleDeck = [];

    for (const suit of SUITS) {
      for (const rank of RANKS) {
        singleDeck.push({ suit, rank });
      }
    }
    singleDeck.push({ suit: "JOKER", rank: "SJ" }); // 小王
    singleDeck.push({ suit: "JOKER", rank: "BJ" }); // 大王

    return singleDeck.concat(singleDeck.map((card) => ({ ...card })));
  }

  /**
   * 原地洗牌（Fisher–Yates）
   */
  function shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  return {
    createDeck,
    shuffle
  };

})();
