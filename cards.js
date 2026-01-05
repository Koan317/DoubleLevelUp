export const SUITS = ["♠", "♥", "♦", "♣"];
export const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];

export function createDeck() {
  const deck = [];
  for (let d = 0; d < 2; d++) {
    for (const s of SUITS) {
      for (const r of RANKS) {
        deck.push({ suit: s, rank: r });
      }
    }
    deck.push({ suit: "JOKER", rank: "小王" });
    deck.push({ suit: "JOKER", rank: "大王" });
  }
  return deck;
}

export function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}
