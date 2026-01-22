// ui-cards.js

window.CardUI = (function () {
  const SUIT_ORDER = ["♠", "♥", "♣", "♦"];
  const DESCENDING_RANKS = ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"];

  function sortHandCards(a, b, state) {
    const keyA = handSortKey(a, state);
    const keyB = handSortKey(b, state);
    const length = Math.max(keyA.length, keyB.length);
    for (let i = 0; i < length; i += 1) {
      const diff = (keyA[i] ?? 0) - (keyB[i] ?? 0);
      if (diff !== 0) return diff;
    }
    return 0;
  }

  function handSortKey(card, state) {
    const isTrump = Rules.isTrump(card, state);
    if (isTrump) {
      if (card.suit === "JOKER") {
        return [0, card.rank === "BJ" ? 0 : 1, 0, 0];
      }
      if (card.rank === state.level) {
        if (card.suit === state.trumpSuit) {
          return [1, 0, 0, 0];
        }
        return [2, suitIndex(card.suit), 0, 0];
      }
      return [3, 0, trumpRankIndex(card, state), 0];
    }
    return [4, suitIndex(card.suit), sideRankIndex(card.rank), 0];
  }

  function suitIndex(suit) {
    const index = SUIT_ORDER.indexOf(suit);
    return index === -1 ? SUIT_ORDER.length : index;
  }

  function trumpRankIndex(card, state) {
    const filtered = DESCENDING_RANKS.filter(rank => rank !== state.level);
    const index = filtered.indexOf(card.rank);
    return index === -1 ? filtered.length : index;
  }

  function sideRankIndex(rank) {
    const index = DESCENDING_RANKS.indexOf(rank);
    return index === -1 ? DESCENDING_RANKS.length : index;
  }

  function createCardElement(card) {
    const el = document.createElement("div");
    const display = cardDisplay(card);
    el.className = `card ${display.isRed ? "red" : ""}`.trim();

    const top = document.createElement("div");
    top.className = "corner top";
    top.innerHTML = `<span class=\"rank\">${display.rank}</span><br><span class=\"suit\">${display.suit}</span>`;
    const bottom = document.createElement("div");
    bottom.className = "corner bottom";
    bottom.innerHTML = `<span class=\"rank\">${display.rank}</span><br><span class=\"suit\">${display.suit}</span>`;
    const center = document.createElement("div");
    center.className = "center";
    center.textContent = display.center;

    el.appendChild(top);
    el.appendChild(center);
    el.appendChild(bottom);
    return el;
  }

  function createCardBackElement() {
    const el = document.createElement("div");
    el.className = "card back";
    return el;
  }

  function cardDisplay(card) {
    if (card.suit === "JOKER") {
      const isBigJoker = card.rank === "BJ";
      const rankName = "JOKER";
      return {
        rank: rankName,
        suit: "",
        center: "🤡",
        isRed: isBigJoker
      };
    }

    const isRed = card.suit === "♥" || card.suit === "♦";
    return {
      rank: card.rank,
      suit: card.suit,
      center: card.suit,
      isRed
    };
  }

  function isSuitKey(key) {
    return key === "♠" || key === "♥" || key === "♣" || key === "♦";
  }

  return {
    sortHandCards,
    handSortKey,
    suitIndex,
    trumpRankIndex,
    sideRankIndex,
    createCardElement,
    createCardBackElement,
    cardDisplay,
    isSuitKey
  };
})();
