import { createDeck, shuffle } from "./cards.js";
import { renderHand, renderStatus } from "./render.js";

export const gameState = {
  players: [[], [], [], []],
  level: "2",
  trumpSuit: null,
  score: 0,
  turn: 0
};

export function startGame() {
  const deck = createDeck();
  shuffle(deck);

  for (let i = 0; i < 100; i++) {
    gameState.players[i % 4].push(deck.pop());
  }
  gameState.kitty = deck;

  renderHand(gameState.players[0]);
  renderStatus(gameState);
}
