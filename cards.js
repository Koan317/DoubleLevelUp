// card.js

window.Cards = (function () {

  const SUITS = ["♠", "♥", "♦", "♣"];
  const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];

  /**
   * 创建 2 副完整扑克牌（108 张）
   * 小王 / 大王不区分花色
   */
  function createDeck() {
    const deck = [];

    for (let d = 0; d < 2; d++) {
      for (const suit of SUITS) {
        for (const rank of RANKS) {
          deck.push({ suit, rank });
        }
      }
      deck.push({ suit: "JOKER", rank: "SJ" }); // 小王
      deck.push({ suit: "JOKER", rank: "BJ" }); // 大王
    }

    return deck;
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
    SUITS,
    RANKS,
    createDeck,
    shuffle
  };

})();
